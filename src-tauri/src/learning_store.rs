use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

const DOCUMENT_ID_KEY: &str = "test-yourself-id:";
static SYNC_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn existing_document_id(content: &str) -> Option<String> {
    let mut lines = content.lines();
    if lines.next()?.trim_end_matches('\r') != "---" {
        return None;
    }
    for line in lines {
        let line = line.trim_end_matches('\r');
        if line == "---" {
            break;
        }
        if let Some(value) = line.trim().strip_prefix(DOCUMENT_ID_KEY) {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

pub(crate) fn ensure_document_id_in_content(
    content: &str,
    generated_id: &str,
) -> Result<String, String> {
    if existing_document_id(content).is_some() {
        return Ok(content.to_string());
    }
    if generated_id.trim().is_empty() || generated_id.contains(['\r', '\n']) {
        return Err("Generated document ID is invalid".to_string());
    }
    if let Some(rest) = content.strip_prefix("---\n") {
        return Ok(format!(
            "---\n{DOCUMENT_ID_KEY} {}\n{rest}",
            generated_id.trim()
        ));
    }
    if let Some(rest) = content.strip_prefix("---\r\n") {
        return Ok(format!(
            "---\r\n{DOCUMENT_ID_KEY} {}\r\n{rest}",
            generated_id.trim()
        ));
    }
    Ok(format!(
        "---\n{DOCUMENT_ID_KEY} {}\n---\n{content}",
        generated_id.trim()
    ))
}

fn positive_number(value: &Value, key: &str) -> Option<u64> {
    value
        .get(key)
        .and_then(Value::as_u64)
        .filter(|value| *value > 0)
}

pub(crate) fn merge_leaf_states(states: &[Value]) -> Result<Value, String> {
    if states.is_empty() {
        return Err("Cannot reconcile an empty set of learning states".to_string());
    }
    let remediation = states
        .iter()
        .any(|state| state.get("status").and_then(Value::as_str) == Some("remediation"));
    let relevant = states.iter().filter(|state| {
        !remediation || state.get("status").and_then(Value::as_str) == Some("remediation")
    });
    let relevant = relevant.collect::<Vec<_>>();
    let current_interval = relevant
        .iter()
        .filter_map(|state| positive_number(state, "currentIntervalDays"))
        .min();
    let resume_interval = relevant
        .iter()
        .filter_map(|state| positive_number(state, "resumeIntervalDays"))
        .min();
    let pending = relevant
        .iter()
        .flat_map(|state| {
            state
                .get("pendingIncorrectIds")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
        })
        .filter_map(Value::as_str)
        .map(str::to_string)
        .collect::<BTreeSet<_>>();

    Ok(json!({
        "currentIntervalDays": current_interval,
        "pendingIncorrectIds": pending,
        "resumeIntervalDays": resume_interval,
        "status": if remediation { "remediation" } else { "scheduled-full" },
    }))
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn write_json_exclusive(path: &Path, value: &Value) -> Result<(), String> {
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| format!("Cannot create {}: {error}", path.display()))?;
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    file.write_all(&bytes).map_err(|error| error.to_string())?;
    file.write_all(b"\n").map_err(|error| error.to_string())
}

fn ensure_document_id(root: &Path, quiz_path: &Path) -> Result<(String, String), String> {
    let quiz_path = std::fs::canonicalize(quiz_path)
        .map_err(|_| format!("Quiz file is not accessible: {}", quiz_path.display()))?;
    if !quiz_path.starts_with(root)
        || quiz_path.extension().and_then(|value| value.to_str()) != Some("md")
    {
        return Err("Learning data references a quiz outside the selected vault".to_string());
    }
    let relative_path = quiz_path
        .strip_prefix(root)
        .map_err(|error| error.to_string())?
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/");
    let content = std::fs::read_to_string(&quiz_path).map_err(|error| error.to_string())?;
    let document_id = existing_document_id(&content).unwrap_or_else(|| {
        uuid::Uuid::new_v5(
            &uuid::Uuid::NAMESPACE_URL,
            format!("test-yourself:{relative_path}").as_bytes(),
        )
        .to_string()
    });
    let updated = ensure_document_id_in_content(&content, &document_id)?;
    if updated != content {
        std::fs::write(&quiz_path, updated).map_err(|error| error.to_string())?;
    }
    Ok((document_id, relative_path))
}

fn read_events(events_dir: &Path) -> Result<Vec<Value>, String> {
    if !events_dir.exists() {
        return Ok(Vec::new());
    }
    let entries = std::fs::read_dir(events_dir).map_err(|error| {
        format!(
            "Cannot read learning event directory {}: {error}",
            events_dir.display()
        )
    })?;
    let mut paths = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "Cannot read an entry in learning event directory {}: {error}",
                events_dir.display()
            )
        })?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) == Some("json") {
            paths.push(path);
        }
    }
    paths.sort();
    paths
        .into_iter()
        .map(|path| {
            let content = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
            serde_json::from_str(&content)
                .map_err(|error| format!("Invalid learning event {}: {error}", path.display()))
        })
        .collect()
}

fn event_id(event: &Value) -> Option<&str> {
    event.get("eventId").and_then(Value::as_str)
}

fn event_parents(event: &Value) -> impl Iterator<Item = &str> {
    event
        .get("parentEventIds")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
}

fn leaves<'a>(events: impl Iterator<Item = &'a Value>) -> Vec<&'a Value> {
    let events = events.collect::<Vec<_>>();
    let parents = events
        .iter()
        .flat_map(|event| event_parents(event))
        .collect::<HashSet<_>>();
    events
        .into_iter()
        .filter(|event| event_id(event).is_some_and(|id| !parents.contains(id)))
        .collect()
}

fn review_signature(review: &Value) -> Option<String> {
    Some(format!(
        "{}|{}|{}",
        review.get("id")?.as_str()?,
        review.get("dueDate")?.as_str()?,
        review.get("intervalDays")?.as_u64()?
    ))
}

fn write_event(events_dir: &Path, event: Value) -> Result<Value, String> {
    let id = event_id(&event).ok_or("Learning event has no ID")?;
    write_json_exclusive(&events_dir.join(format!("{id}.json")), &event)?;
    Ok(event)
}

pub(crate) fn sync_learning_data_at_root(root: &Path, local: Value) -> Result<Value, String> {
    let root = std::fs::canonicalize(root)
        .map_err(|_| "Configured quiz directory is not accessible".to_string())?;
    let store_dir = root.join(".test-yourself");
    let events_dir = store_dir.join("events");
    std::fs::create_dir_all(&events_dir).map_err(|error| error.to_string())?;
    let mut events = read_events(&events_dir)?;

    let existing_attempt_ids = events
        .iter()
        .flat_map(|event| {
            event
                .get("attempts")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
        })
        .filter_map(|attempt| attempt.get("id").and_then(Value::as_str))
        .map(str::to_string)
        .collect::<HashSet<_>>();
    let existing_review_signatures = events
        .iter()
        .flat_map(|event| {
            event
                .get("reviewSets")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
        })
        .filter_map(review_signature)
        .collect::<HashSet<_>>();
    let local_reviews = local
        .get("reviewSets")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for record in local
        .get("records")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let Some(quiz_path) = record.get("quizPath").and_then(Value::as_str) else {
            continue;
        };
        let Ok((document_id, relative_path)) = ensure_document_id(&root, Path::new(quiz_path))
        else {
            // A previous installation can retain an absolute path from an old
            // clone or another vault. It must not block reading events that
            // are valid for the currently configured root.
            continue;
        };
        let new_attempts = record
            .get("attempts")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter(|attempt| {
                attempt
                    .get("id")
                    .and_then(Value::as_str)
                    .is_some_and(|id| !existing_attempt_ids.contains(id))
            })
            .cloned()
            .collect::<Vec<_>>();
        let new_reviews = local_reviews
            .iter()
            .filter(|review| review.get("quizPath").and_then(Value::as_str) == Some(quiz_path))
            .filter(|review| {
                review_signature(review)
                    .is_some_and(|signature| !existing_review_signatures.contains(&signature))
            })
            .cloned()
            .map(|mut review| {
                review["quizPath"] = json!(relative_path);
                review
            })
            .collect::<Vec<_>>();
        if new_attempts.is_empty() && new_reviews.is_empty() {
            continue;
        }
        let parent_event_ids =
            leaves(events.iter().filter(|event| {
                event.get("documentId").and_then(Value::as_str) == Some(&document_id)
            }))
            .into_iter()
            .filter_map(event_id)
            .collect::<Vec<_>>();
        let event = json!({
            "version": 1,
            "eventId": uuid::Uuid::new_v4().to_string(),
            "documentId": document_id,
            "relativePath": relative_path,
            "contentKind": record.get("contentKind").cloned().unwrap_or(json!("quiz")),
            "parentEventIds": parent_event_ids,
            "writtenAtMs": now_millis(),
            "state": record.get("state").cloned().unwrap_or(Value::Null),
            "attempts": new_attempts,
            "reviewSets": new_reviews,
        });
        events.push(write_event(&events_dir, event)?);
    }

    let document_ids = events
        .iter()
        .filter_map(|event| event.get("documentId").and_then(Value::as_str))
        .map(str::to_string)
        .collect::<BTreeSet<_>>();
    for document_id in document_ids {
        let branch_leaves = leaves(events.iter().filter(|event| {
            event.get("documentId").and_then(Value::as_str) == Some(document_id.as_str())
        }));
        if branch_leaves.len() <= 1 {
            continue;
        }
        let mut parent_ids = branch_leaves
            .iter()
            .filter_map(|event| event_id(event).map(str::to_string))
            .collect::<Vec<_>>();
        parent_ids.sort();
        let reconciliation_id = format!(
            "reconcile-{}",
            uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_OID, parent_ids.join("|").as_bytes())
        );
        if events
            .iter()
            .any(|event| event_id(event) == Some(&reconciliation_id))
        {
            continue;
        }
        let states = branch_leaves
            .iter()
            .filter_map(|event| event.get("state").cloned())
            .collect::<Vec<_>>();
        let template = branch_leaves
            .first()
            .copied()
            .ok_or("Cannot reconcile learning progress without a branch head")?;
        let event = json!({
            "version": 1,
            "eventId": reconciliation_id,
            "documentId": document_id,
            "relativePath": template.get("relativePath").cloned().unwrap_or(Value::Null),
            "contentKind": template.get("contentKind").cloned().unwrap_or(json!("quiz")),
            "parentEventIds": parent_ids,
            "writtenAtMs": branch_leaves
                .iter()
                .filter_map(|event| event.get("writtenAtMs").and_then(Value::as_u64))
                .max()
                .unwrap_or(0)
                .saturating_add(1),
            "state": merge_leaf_states(&states)?,
            "attempts": [],
            "reviewSets": [],
        });
        events.push(write_event(&events_dir, event)?);
    }

    if !store_dir.join("migration-v1.json").exists()
        && local
            .get("records")
            .and_then(Value::as_array)
            .is_some_and(|records| !records.is_empty())
    {
        write_json_exclusive(
            &store_dir.join("migration-v1.json"),
            &json!({ "version": 1 }),
        )?;
    }

    reconstruct_learning_data(&root, &events)
}

fn reconstruct_learning_data(root: &Path, events: &[Value]) -> Result<Value, String> {
    let mut by_document = BTreeMap::<String, Vec<&Value>>::new();
    for event in events {
        if let Some(document_id) = event.get("documentId").and_then(Value::as_str) {
            by_document
                .entry(document_id.to_string())
                .or_default()
                .push(event);
        }
    }
    let mut records = Vec::new();
    let mut reviews_by_id = BTreeMap::<String, (u64, Value)>::new();
    for (_document_id, document_events) in by_document {
        let template = document_events
            .iter()
            .max_by_key(|event| {
                event
                    .get("writtenAtMs")
                    .and_then(Value::as_u64)
                    .unwrap_or(0)
            })
            .ok_or("Missing learning event")?;
        let relative_path = template
            .get("relativePath")
            .and_then(Value::as_str)
            .ok_or("Learning event has no relative path")?;
        let quiz_path = root
            .join(PathBuf::from(relative_path))
            .to_string_lossy()
            .into_owned();
        let leaf_events = leaves(document_events.iter().copied());
        let states = leaf_events
            .iter()
            .filter_map(|event| event.get("state").cloned())
            .collect::<Vec<_>>();
        let state = match states.as_slice() {
            [state] => state.clone(),
            _ => merge_leaf_states(&states)?,
        };
        let mut attempts_by_id = BTreeMap::<String, Value>::new();
        for event in &document_events {
            for attempt in event
                .get("attempts")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                if let Some(id) = attempt.get("id").and_then(Value::as_str) {
                    attempts_by_id.insert(id.to_string(), attempt.clone());
                }
            }
            let written_at = event
                .get("writtenAtMs")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            for review in event
                .get("reviewSets")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                if let Some(id) = review.get("id").and_then(Value::as_str) {
                    let mut review = review.clone();
                    review["quizPath"] = json!(quiz_path);
                    if reviews_by_id
                        .get(id)
                        .is_none_or(|(previous, _)| written_at >= *previous)
                    {
                        reviews_by_id.insert(id.to_string(), (written_at, review));
                    }
                }
            }
        }
        let mut attempts = attempts_by_id.into_values().collect::<Vec<_>>();
        attempts.sort_by_key(|attempt| {
            attempt
                .get("assessedAt")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string()
        });
        records.push(json!({
            "quizPath": quiz_path,
            "contentKind": template.get("contentKind").cloned().unwrap_or(json!("quiz")),
            "state": state,
            "attempts": attempts,
        }));
    }
    Ok(json!({
        "version": 1,
        "records": records,
        "reviewSets": reviews_by_id.into_values().map(|(_, review)| review).collect::<Vec<_>>(),
    }))
}

#[tauri::command]
pub(crate) async fn sync_learning_progress(
    app_handle: tauri::AppHandle,
    local_data: Value,
) -> Result<Value, String> {
    let root = PathBuf::from(super::configured_quiz_root(&app_handle).await?);
    tokio::task::spawn_blocking(move || {
        let _guard = SYNC_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .map_err(|_| "Learning progress sync lock is unavailable".to_string())?;
        sync_learning_data_at_root(&root, local_data)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::{ensure_document_id_in_content, merge_leaf_states, sync_learning_data_at_root};
    use serde_json::json;

    #[test]
    fn adds_and_reuses_a_document_id_without_changing_markdown() {
        let markdown = "---\ntags: [security]\n---\n# Quiz\n";
        let updated = ensure_document_id_in_content(markdown, "doc-123").unwrap();

        assert_eq!(
            updated,
            "---\ntest-yourself-id: doc-123\ntags: [security]\n---\n# Quiz\n"
        );
        assert_eq!(
            ensure_document_id_in_content(&updated, "ignored").unwrap(),
            updated
        );
    }

    #[test]
    fn conservatively_reconciles_concurrent_learning_states() {
        let merged = merge_leaf_states(&[
            json!({
                "currentIntervalDays": 14,
                "pendingIncorrectIds": [],
                "resumeIntervalDays": null,
                "status": "scheduled-full"
            }),
            json!({
                "currentIntervalDays": 7,
                "pendingIncorrectIds": ["2"],
                "resumeIntervalDays": 3,
                "status": "remediation"
            }),
        ])
        .unwrap();

        assert_eq!(merged["status"], "remediation");
        assert_eq!(merged["currentIntervalDays"], 7);
        assert_eq!(merged["resumeIntervalDays"], 3);
        assert_eq!(merged["pendingIncorrectIds"], json!(["2"]));
    }

    #[test]
    fn resolves_synced_review_sets_against_a_new_vault_root() {
        let temp = tempfile::tempdir().unwrap();
        let first_root = temp.path().join("first-vault");
        std::fs::create_dir_all(first_root.join("Security")).unwrap();
        let first_quiz = first_root.join("Security/csp.md");
        std::fs::write(&first_quiz, "# CSP quiz\n").unwrap();
        let local = json!({
            "version": 1,
            "records": [{
                "quizPath": first_quiz,
                "contentKind": "quiz",
                "state": {
                    "currentIntervalDays": 3,
                    "pendingIncorrectIds": [],
                    "resumeIntervalDays": null,
                    "status": "scheduled-full"
                },
                "attempts": [{
                    "id": "review-123:attempt",
                    "assessedAt": "2026-10-18T10:00:00.000Z",
                    "scope": "full",
                    "assessments": { "1": "correct" }
                }]
            }],
            "reviewSets": [{
                "id": "review-123",
                "quizPath": first_quiz,
                "contentKind": "quiz",
                "scope": "full",
                "questionIds": ["1"],
                "dueDate": "2026-10-21",
                "intervalDays": 3,
                "createdAt": "2026-10-18T10:00:00.000Z"
            }]
        });
        sync_learning_data_at_root(&first_root, local.clone()).unwrap();

        let second_root = temp.path().join("second-vault");
        std::fs::rename(&first_root, &second_root).unwrap();
        let synced = sync_learning_data_at_root(&second_root, local).unwrap();

        assert_eq!(synced["reviewSets"][0]["id"], "review-123");
        assert_eq!(
            synced["reviewSets"][0]["quizPath"],
            second_root
                .join("Security/csp.md")
                .to_string_lossy()
                .as_ref()
        );
        assert!(std::fs::read_to_string(second_root.join("Security/csp.md"))
            .unwrap()
            .contains("test-yourself-id:"));
        assert!(second_root
            .join(".test-yourself/migration-v1.json")
            .exists());
    }

    #[test]
    fn reports_a_corrupt_event_instead_of_panicking() {
        let temp = tempfile::tempdir().unwrap();
        let events = temp.path().join(".test-yourself/events");
        std::fs::create_dir_all(&events).unwrap();
        let corrupt = events.join("corrupt.json");
        std::fs::write(&corrupt, "{not-json").unwrap();

        let error = sync_learning_data_at_root(
            temp.path(),
            json!({ "version": 1, "records": [], "reviewSets": [] }),
        )
        .expect_err("corrupt event JSON must be returned as an error");

        assert!(error.contains("Invalid learning event"));
        assert!(error.contains("corrupt.json"));
    }
}
