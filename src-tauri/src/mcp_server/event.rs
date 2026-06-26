use serde_json::{json, Value};

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ActionCommand {
    #[serde(rename = "type")]
    pub action_type: String,
    pub name: Option<String>,
    pub url: Option<String>,
    pub weight: Option<f32>,
    pub bone: Option<String>,
    pub x: Option<f32>,
    pub y: Option<f32>,
    pub z: Option<f32>,
}

pub struct ParsedEvent {
    pub event_type: &'static str,
    pub meta: Value,
    pub actions: Vec<ActionCommand>,
}

pub fn parse_event(tool_name: &str, tool_input: Option<&Value>) -> ParsedEvent {
    let event_type = match tool_name {
        "Write" => "trigger:write",
        "Exec" => "trigger:exec",
        "Read" => "trigger:read",
        "Stop" => "thinking:end",
        _ => "thinking",
    };

    let actions = tool_input
        .and_then(|input| input.get("actions"))
        .and_then(|v| serde_json::from_value::<Vec<ActionCommand>>(v.clone()).ok())
        .unwrap_or_default();

    ParsedEvent { event_type, meta: json!({"tool_name": tool_name}), actions }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_write() {
        let input = json!({"file_path": "src/foo.ts"});
        let event = parse_event("Write", Some(&input));
        assert_eq!(event.event_type, "trigger:write");
        assert!(event.actions.is_empty());
    }

    #[test]
    fn test_parse_exec() {
        let input = json!({"command": "pnpm build"});
        let event = parse_event("Exec", Some(&input));
        assert_eq!(event.event_type, "trigger:exec");
    }

    #[test]
    fn test_parse_stop() {
        let event = parse_event("Stop", None);
        assert_eq!(event.event_type, "thinking:end");
    }

    #[test]
    fn test_parse_read() {
        let event = parse_event("Read", None);
        assert_eq!(event.event_type, "trigger:read");
    }

    #[test]
    fn test_parse_unknown_tool() {
        let event = parse_event("SomeUnknownTool", None);
        assert_eq!(event.event_type, "thinking");
    }

    #[test]
    fn test_parse_actions() {
        let input = json!({
            "actions": [
                {"type": "play_anim", "name": "Clapping"},
                {"type": "expression", "name": "happy", "weight": 0.8},
                {"type": "bone_pose", "bone": "head", "x": 0.3, "y": 0.0, "z": 0.0}
            ]
        });
        let event = parse_event("Write", Some(&input));
        assert_eq!(event.actions.len(), 3);
        assert_eq!(event.actions[0].action_type, "play_anim");
        assert_eq!(event.actions[0].name.as_deref(), Some("Clapping"));
        assert_eq!(event.actions[1].action_type, "expression");
        assert_eq!(event.actions[1].name.as_deref(), Some("happy"));
        assert_eq!(event.actions[2].action_type, "bone_pose");
    }

    #[test]
    fn test_parse_actions_empty() {
        let input = json!({"some_field": "value"});
        let event = parse_event("Read", Some(&input));
        assert!(event.actions.is_empty());
    }

    #[test]
    fn test_parse_actions_invalid_type() {
        let input = json!({"actions": "not an array"});
        let event = parse_event("Read", Some(&input));
        assert!(event.actions.is_empty());
    }
}
