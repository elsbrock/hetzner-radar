import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
	_3R60S: any;
}

export default class extends WorkerEntrypoint<Env> {
	async fetch(): Promise<Response> {
		return new Response();
	}
	async limit(key: string): Promise<boolean> {
		const { success } = await this.env._3R60S.limit({ key })
		if (!success) {
			console.warn("Rate limit exceeded for key:", key);
		}
		return success;
	}
}
