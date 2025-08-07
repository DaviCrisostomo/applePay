import fetch from "node-fetch";

export class PayrocTokenService {
    #apiKey;
    #authorization;

    constructor() {
        this.#apiKey = process.env.PAYROC_API_KEY;
    }

    async getAccessToken() {
        if (await this.#isTokenExpired()) {
            await this.#authorize();
        }
        return this.#authorization?.access_token || "";
    }

    async #authorize() {
        const response = await this.#fetchWithErrorHandling(process.env.PAYROC_IDENTITY_SERVICE_HOST, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": this.#apiKey,
            },
        });
        response.issuedAt = Date.now();
        this.#authorization = response;
    }

    async #isTokenExpired() {
        if (!this.#authorization?.issuedAt) return true;

        const currentTime = Date.now();
        const expirationTime = this.#authorization.issuedAt + this.#authorization.expires_in * 1000;
        return currentTime >= expirationTime;
    }

    async #fetchWithErrorHandling(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text);
        }
        return response.json();
    }
}
