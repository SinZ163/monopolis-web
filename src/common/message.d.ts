import { CustomGameEventDeclarations } from "./events";

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
interface ResumeMessage {
    type: "resume";
    localId: string;
}
type WSMessage = RegisterMessage | ChangeMessage | EventMessage | ResumeMessage;