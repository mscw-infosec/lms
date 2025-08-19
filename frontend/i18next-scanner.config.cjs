// @ts-nocheck
/* i18next-scanner configuration for Next.js + TSX project */
const typescriptTransform = require("i18next-scanner-typescript");

module.exports = {
	input: [
		"src/**/*.{ts,tsx}",
		// Excludes
		"!**/node_modules/**",
		"!**/.next/**",
		"!**/dist/**",
	],
	output: "./",
	options: {
		debug: false,
		func: {
			list: ["t", "i18n.t"],
			// Do not treat dots as nested keys; we use flat keys in common.json
			// IMPORTANT: keep only js/jsx here when using the TS transform
			extensions: [".js", ".jsx"],
		},
		trans: {
			// Support <Trans i18nKey="..." />
			component: "Trans",
			i18nKey: "i18nKey",
			fallbackKey: false,
			// IMPORTANT: keep only js/jsx here when using the TS transform
			extensions: [".js", ".jsx"],
		},
		lngs: ["en", "ru"],
		ns: ["common"],
		defaultLng: "en",
		defaultNs: "common",
		defaultValue: (lng, ns, key) => {
			// Keep EN default to key itself, for RU leave empty to translate later
			if (lng === "en") return key;
			return "";
		},
		resource: {
			loadPath: "public/locales/{{lng}}/{{ns}}.json",
			savePath: "public/locales/{{lng}}/{{ns}}.json",
			jsonIndent: 2,
			lineEnding: "\n",
		},
		keySeparator: false, // we use flat keys
		nsSeparator: false,
		sort: true,
		removeUnusedKeys: false,
		plural: false,
	},
	// Parse TS/TSX using the official transform
	transform: typescriptTransform(),
};
