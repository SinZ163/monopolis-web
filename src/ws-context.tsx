import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  Signal,
  untrack,
  useContext,
} from "solid-js";
import { getReasonForWebSocketClose } from "./server-actions";
import { EventMessage, StartEventMessage } from "./common/message";

interface WSContextType {
  ws: WebSocket;
  dispatch: <T extends Omit<EventMessage | StartEventMessage, "type">>(
    event: T
  ) => void;
  createWSSignal: <T,>(
    identifier: string,
    defaultValue: T
  ) => Signal<T>;
}
export const WSContext = createContext<WSContextType>();

export const useWSContext = () => {
    const context = useContext(WSContext);
    if (!context) {
        throw new Error("Missing WSContext");
    }
    return context;
}

export const createWebSocket = () => {
  const [wsErrorReason, setWsErrorReason] = createSignal("");
  const [wsReady, setWSReady] = createSignal(false);

  const protocol = window.location.protocol === "http:" ? "ws" : "wss";
  const ws = new WebSocket(`${protocol}://${window.location.host}/_ws`);

  ws.addEventListener("open", () => setWSReady(true));
  ws.addEventListener("close", async (e) => {
    setWSReady(false);
    if (e.reason === "") {
      let serverReason = await getReasonForWebSocketClose(e.code, e.reason);
      setWsErrorReason(serverReason);
    } else {
      setWsErrorReason(e.reason);
    }
  });

  const wsRegistrationCache: Record<string, any> = {};
  ws.addEventListener("message", async (ev) => {
    let data = ev.data;
    if (ev.data instanceof Blob) {
      data = await ev.data.text();
    }
    let msg = JSON.parse(data);

    // Cloudflare disconnects websockets if they are idle for ~60-100 seconds
    if ("type" in msg && msg["type"] === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
    if ("id" in msg) {
      wsRegistrationCache[msg.id] = msg.value;
    }
  });

  const createWSSignal = <T,>(
    identifier: string,
    defaultValue: T
  ): Signal<T> => {
    const [value, setValue] = createSignal(defaultValue);

    const [bypass, setBypass] = createSignal(true);
    if (!wsRegistrationCache[identifier]) {
      ws.send(
        JSON.stringify({
          type: "register",
          id: identifier,
          defaultValue,
        })
      );
    } else {
      setBypass(true);
      setValue(wsRegistrationCache[identifier]);
    }

    const handleMessage = async (ev: MessageEvent) => {
      let data = ev.data;
      if (ev.data instanceof Blob) {
        data = await ev.data.text();
      }
      let msg = JSON.parse(data);
      if ("id" in msg && msg.id === identifier) {
        setBypass(true);
        setValue(msg.value);
      }
    };
    ws.addEventListener("message", handleMessage);
    onCleanup(() => {
      ws.removeEventListener("message", handleMessage);
    });

    createEffect(() => {
      const val = value();
      if (ws.readyState !== ws.OPEN) return;
      let bypassVal = false;
      untrack(() => {
        bypassVal = bypass();
      });
      if (bypassVal) {
        setBypass(false);
        return;
      }
      ws.send(
        JSON.stringify({
          type: "change",
          id: identifier,
          value: value(),
        })
      );
    });
    return [value, setValue];
  };

  const dispatch = <T extends Omit<EventMessage | StartEventMessage, "type">>(
    event: T
  ) => {
    ws.send(
      JSON.stringify({
        ...event,
        type: event.id.startsWith("start_") ? "startevent" : "event",
      })
    );
  };

  return {
    context: {
      ws,
      createWSSignal,
      dispatch,
    },
    wsErrorReason,
    wsReady,
  };
};
