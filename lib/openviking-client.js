function endpoint(base, path) {
    return `${base.replace(/\/$/, "")}${path}`;
}
function headers(connection) {
    if (connection.apiKey === "")
        return {};
    return {
        Authorization: `Bearer ${connection.apiKey}`,
        ...(connection.account === "" ? {} : { "X-OpenViking-Account": connection.account }),
        ...(connection.user === "" ? {} : { "X-OpenViking-User": connection.user }),
    };
}
function identityOf(value) {
    if (typeof value !== "object" || value === null)
        return { account: "", user: "" };
    const result = value.result;
    if (typeof result !== "object" || result === null)
        return { account: "", user: "" };
    const record = result;
    return {
        account: typeof record.account === "string" ? record.account : typeof record.account_id === "string" ? record.account_id : "",
        user: typeof record.user === "string" ? record.user : typeof record.user_id === "string" ? record.user_id : "",
    };
}
/** Probe only normal data-plane endpoints with a user key; never accept root keys. */
export async function probeOpenViking(connection, fetchFn = fetch) {
    try {
        const health = await fetchFn(endpoint(connection.url, "/health"));
        if (!health.ok)
            return { reachable: false, ready: false, authenticated: false, identity: undefined };
    }
    catch {
        return { reachable: false, ready: false, authenticated: false, identity: undefined };
    }
    let ready = false;
    try {
        ready = (await fetchFn(endpoint(connection.url, "/ready"))).ok;
    }
    catch {
        ready = false;
    }
    if (connection.apiKey === "")
        return { reachable: true, ready, authenticated: false, identity: undefined };
    try {
        const status = await fetchFn(endpoint(connection.url, "/api/v1/system/status"), { headers: headers(connection) });
        if (!status.ok)
            return { reachable: true, ready, authenticated: false, identity: undefined };
        const identity = identityOf(await status.json());
        return { reachable: true, ready, authenticated: true, identity };
    }
    catch {
        return { reachable: true, ready, authenticated: false, identity: undefined };
    }
}
