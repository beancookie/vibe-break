use serde_json::{json, Value};

pub struct ParsedEvent {
    pub event_type: &'static str,
    pub meta: Value,
}

pub fn parse_event(tool_name: &str, tool_input: Option<&Value>) -> ParsedEvent {
    let event_type = match tool_name {
        "Write" | "Edit" => "file.write",
        "Bash" => "command.exec",
        "Stop" => "thinking:end",
        _ => "thinking",
    };

    let mut meta = json!({});
    if let Some(input) = tool_input {
        if event_type == "file.write" {
            if let Some(path) = input.get("file_path").and_then(|v| v.as_str()) {
                meta["path"] = json!(path);
            }
        } else if event_type == "command.exec" {
            if let Some(cmd) = input.get("command").and_then(|v| v.as_str()) {
                meta["command"] = json!(cmd);
            }
        }
    }

    ParsedEvent { event_type, meta }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_file_write() {
        let input = json!({"file_path": "src/foo.ts"});
        let event = parse_event("Write", Some(&input));
        assert_eq!(event.event_type, "file.write");
        assert_eq!(event.meta["path"], "src/foo.ts");
    }

    #[test]
    fn test_parse_edit() {
        let input = json!({"file_path": "src/bar.ts"});
        let event = parse_event("Edit", Some(&input));
        assert_eq!(event.event_type, "file.write");
        assert_eq!(event.meta["path"], "src/bar.ts");
    }

    #[test]
    fn test_parse_bash() {
        let input = json!({"command": "pnpm build"});
        let event = parse_event("Bash", Some(&input));
        assert_eq!(event.event_type, "command.exec");
        assert_eq!(event.meta["command"], "pnpm build");
    }

    #[test]
    fn test_parse_stop() {
        let event = parse_event("Stop", None);
        assert_eq!(event.event_type, "thinking:end");
    }

    #[test]
    fn test_parse_read_defaults_to_thinking() {
        let event = parse_event("Read", None);
        assert_eq!(event.event_type, "thinking");
    }

    #[test]
    fn test_parse_unknown_tool() {
        let event = parse_event("SomeUnknownTool", None);
        assert_eq!(event.event_type, "thinking");
    }

    #[test]
    fn test_parse_file_write_missing_path() {
        let input = json!({"other": "value"});
        let event = parse_event("Write", Some(&input));
        assert_eq!(event.event_type, "file.write");
        assert_eq!(event.meta.get("path"), None);
    }
}
