/// <reference types="@solidjs/start/env" />
import * as THREEType from "three";

declare global {
    interface Window {
        THREE: typeof THREEType;
    }
    var THREE: typeof THREEType;
}


export {};
