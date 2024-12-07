"use server";

import { getWebRequest } from "vinxi/http";

declare namespace NodeJS {
    interface ProcessEnv {
        ipToReason: string;
    }
}

export async function getReasonForWebSocketClose(code: number, reason:string) {
    const req = getWebRequest();

    const cfIP = req.headers.get("cf-connecting-ip");
    if (!cfIP) {
        return "Not Deployed";
    }
    const ipChain = req.headers.get("x-forwarded-for");
    if (!ipChain) {
        return "Not Deployed";
    }
    const forwardedIps = ipChain.split(",");

    let response = "";
    if (cfIP !== forwardedIps[0]) {
        response += "There are network appliances between you and Monopolis that may be blocking traffic\n";
    }

    if (process.env.ipToReason) {
        const ipDB = JSON.parse(process.env.ipToReason) as unknown as Record<string, string|undefined>;
        if (ipDB[cfIP]) {
            response += "Detected " + ipDB[cfIP];
        }
    }
    return response;
}