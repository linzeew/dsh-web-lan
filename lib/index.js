/**
 * dsh-web-lan - LAN deployment for the dsh browser surface.
 *
 * This module is the glue for the `web-lan-token` row declared in
 * cordis.patch.yml. Once the `connection` service (dsh-client-connection)
 * is available it swaps that service's `browserAuth.launchToken` field for
 * the configured value.
 *
 * Why a field swap is enough: BrowserAuth reads `this.launchToken` at call
 * time in both `authenticatedUrl` (the printed `dsh web:` ready URL) and
 * `authorizeIndex` (the `?token=` exchange on the index route), and the
 * row's injection guarantees the swap happens before the web-app glue prints
 * that URL after the loader settles. The signed-cookie secret is untouched,
 * so browser sessions established before the swap keep validating.
 *
 * Unset or blank token -> no-op: the upstream random per-process token stays
 * in effect, so the plugin is purely opt-in.
 */

/** Stable cordis plugin identity (diagnostics and logs). */
const name = "web-lan";

/** Activate once the web connection service is provided. */
const inject = ["connection"];

/** URL-safe token alphabet: letters, digits, . _ ~ + / = - */
const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]+$/;

/**
 * Fix the launch token when one is configured.
 * @param ctx - the row's plugin context (the `connection` service is already available).
 * @param config - row config: `token` - the fixed launch token (string, from DSH_WEB_TOKEN or a literal).
 * @throws when the token has an unusable shape, or the connection service no longer exposes its auth owner.
 */
function apply(ctx, config) {
	const raw = config?.token;
	const token = typeof raw === "string" ? raw.trim() : void 0;
	if (token === void 0 || token === "") return; // unset: keep the random per-process token
	if (token.length > 256 || !TOKEN_PATTERN.test(token)) {
		throw new Error(
			"web-lan: the launch token must be 1-256 characters of URL-safe characters " +
			"(letters, digits, . _ ~ + / = -); got a " + token.length + "-character value"
		);
	}
	const connection = ctx.get("connection");
	const auth = connection?.browserAuth;
	if (auth === void 0 || typeof auth.launchToken !== "string") {
		throw new Error("web-lan: the connection service exposes no browserAuth launch token; cannot fix it");
	}
	auth.launchToken = token;
	ctx.logger?.info?.("web-lan: launch token fixed to a %d-character user value", token.length);
}

export { name, inject, apply };
