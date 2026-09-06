import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

// Only attach browser-specific plugins when running in the browser
const isBrowser = typeof window !== "undefined";

if (isBrowser) {
	i18n.use(HttpBackend).use(LanguageDetector);
}

i18n.use(initReactI18next).init({
	fallbackLng: "ru",
	debug: false,
	ns: ["common"],
	defaultNS: "common",
	supportedLngs: ["en", "ru"],
	detection: {
		order: ["localStorage"],
		lookupLocalStorage: "lang",
		caches: ["localStorage"],
	},
	react: {
		useSuspense: false,
	},
	interpolation: {
		escapeValue: false,
	},
	backend: {
		loadPath: "/locales/{{lng}}/{{ns}}.json",
	},
	load: "languageOnly",
});

export default i18n;
