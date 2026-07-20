import rotunda from "../data/rotunda.json";
import { normalizeVisibilityPolicy } from "../utils/tag.js";

function warnDev(message, error) {
    if (!import.meta.env?.DEV) return;
    if (error) console.warn(message, error);
    else console.warn(message);
}

export class VisibilityPolicyStore extends EventTarget {
    constructor(provider = null) {
        super();
        this.provider = provider || (() => Promise.resolve(rotunda));
        this.policy = normalizeVisibilityPolicy(rotunda);
        this.loading = null;
    }

    async refresh() {
        this.loading = Promise.resolve().then(this.provider).then(raw => normalizeVisibilityPolicy(raw)).catch(error => {
            warnDev("Rotunda policy failed to load; using empty public rotunda policy.", error);
            return normalizeVisibilityPolicy(null);
        }).then(policy => {
            this.policy = policy;
            this.dispatchEvent(new CustomEvent("change", { detail: policy }));
            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("visibility-policy-changed", { detail: policy }));
            return policy;
        });
        return this.loading;
    }

    get() { return this.policy; }
}

export const visibilityPolicyStore = new VisibilityPolicyStore();
