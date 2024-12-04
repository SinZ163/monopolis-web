import * as THREE from "three";
window.THREE = THREE;

// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";


mount(() => <StartClient />, document.getElementById("app")!);
