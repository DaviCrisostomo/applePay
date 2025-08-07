import fetch from "node-fetch";
import { randomUUID } from "crypto";
import { PayrocTokenService } from "./payroc_token_service.js";

export class PayrocClient {
    #tokenService;
    #processingTerminalId;
    #appleDomain;
    #currency;

    constructor() {
        this.#tokenService = new PayrocTokenService();
        this.#processingTerminalId = process.env.PROCESSING_TERMINAL_ID;
        this.#appleDomain = process.env.APPLE_DOMAIN;
        this.#currency = process.env.TERMINAL_CURRENCY;
    }

    async getAppleSession(validationURL) {
        const reqUrl = `${process.env.PAYROC_API_HOST}/processing-terminals/${this.#processingTerminalId}/apple-pay-sessions`;
        const headers = await this.#getHeader();
        return await this.#fetchWithErrorHandling(reqUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
                appleDomainId: this.#appleDomain,
                appleValidationUrl: validationURL
            }),
        });
    }

    async createPayment(amount, description = "Apple Payment", hexToken) {
        const paymentUrl = this.#getPaymentURL();
        const headers = await this.#getHeader();

        return await this.#fetchWithErrorHandling(paymentUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
                processingTerminalId: this.#processingTerminalId,
                channel: "web",
                order: {
                    orderId: Date.now().toString(),
                    description,
                    currency: this.#currency,
                    amount,
                },
                paymentMethod: this.#getPaymentMethod(hexToken),
            }),
        });
    }

    async #getHeader() {
        const accessToken = await this.#tokenService.getAccessToken();
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "Idempotency-Key": randomUUID(),
        };
    }

    #getPaymentMethod(hexToken) {
        return {
            type: "digitalWallet",
            serviceProvider: "apple",
            encryptedData: hexToken
        };
    }

    #getPaymentURL() {
        return `${process.env.PAYROC_API_HOST}/payments`;
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
