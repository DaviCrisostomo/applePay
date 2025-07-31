import fetch from "node-fetch";
import { randomUUID } from "crypto";

export class PayrocClient {
    #apiKey;
    #authorization;
    #processingTerminalId;
    #appleDomain;
    #currency;

    constructor() {
        this.#apiKey = process.env.PAYROC_API_KEY;
        this.#processingTerminalId = process.env.PROCESSING_TERMINAL_ID;
        this.#appleDomain = process.env.APPLE_DOMAIN;
        this.#currency = process.env.CURRENCY;
    }

    async getAppleSession(){
        const reqUrl = `${process.env.PAYROC_API_HOST}/processing-terminals/${this.#processingTerminalId}/apple-pay-sessions`;
        const headers = await this.#getHeader();
        const response = await this.#fetchWithErrorHandling(reqUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                appleDomainId: this.#appleDomain,
                appleValidationUrl: "https://apple-pay-gateway-cert.apple.com/paymentservices/startSession"
            }),
        });

        return response;
    }

    async createPayment(
        amount,
        description = "Apple Payment",
        applePayload
    ) {
        const paymentUrl = this.#getPaymentURL();
        const paymentMethod = this.#getPaymentMethod(applePayload);
        const headers = await this.#getHeader();

        const response = await this.#fetchWithErrorHandling(paymentUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                processingTerminalId: this.#processingTerminalId,
                channel: "web",
                order: {
                    orderId: Date.now().toString(),
                    description,
                    currency: this.#currency,
                    amount,
                },
                paymentMethod,
            }),
        });
        console.log(response);
        return response;
    }

    async #fetchWithErrorHandling(url, options) {
        console.log("OPTS:", options);
        const response = await fetch(url, options);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text);
        }
        return response.json();
    }

    #getPaymentURL() {
        return `${process.env.PAYROC_API_HOST}/payments`;
    }

    #getPaymentMethod(applePayload) {
        var encryptedData = this.#getEncryptedData(applePayload);
        return JSON.stringify({
            type: "digitalWallet",
            serviceProvider: "apple",
            encryptedData
        });
    }

    #getEncryptedData(s) {
        // utf8 to latin1
        var unescaped = unescape(encodeURIComponent(s))
        var hex = ''
        for (var i = 0; i < unescaped.length; i++) {
            hex += unescaped.charCodeAt(i).toString(16)
        }
        return hex;
    }

    async #getHeader() {
        const accessToken = await this.getAccessToken();
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "Idempotency-Key": randomUUID(),
        };
    }

    async getAccessToken() {
        if (await this.#isTokenExpired()) {
            await this.#authorize();
        }
        return this.#authorization?.access_token || "";
    }

    async #isTokenExpired() {
        if (!this.#authorization?.issuedAt) return true;

        const currentTime = Date.now();
        const expirationTime = this.#authorization.issuedAt + this.#authorization.expires_in * 1000;
        return currentTime >= expirationTime;
    }

    async #authorize() {
        const response = await this.#fetchWithErrorHandling(process.env.PAYROC_IDENTITY_SERVICE_HOST, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": this.#apiKey,
            },
        });

        this.#authorization = response;
    }
}
