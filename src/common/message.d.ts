import { CustomGameEventDeclarations, StartEvents } from "./events";

interface RegisterMessage {
    type: "register";
    id: string;
    defaultValue: any;
}
interface ChangeMessage {
    type: "change";
    id: string;
    value: any;
}
interface EventMessage {
    type: "event";
    id: keyof CustomGameEventDeclarations;
    payload: CustomGameEventDeclarations[EventMessage["id"]];
}
interface StartEventMessage  {
    type: "startevent";
    id: keyof StartEvents;
    payload: StartEvents[StartEventMessage["id"]];
}
interface ResumeMessage {
    type: "resume";
    localId: string;
}
type WSMessage = RegisterMessage | ChangeMessage | EventMessage | StartEventMessage | ResumeMessage;