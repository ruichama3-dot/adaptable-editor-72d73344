import { useEffect, useState } from "react";

export type Theme = "claro" | "escuro";
export type Lang = "pt" | "en";

const THEME_KEY = "ruje-theme";
const LANG_KEY = "ruje-lang";
const EVENT = "ruje-prefs";

export function readTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === "escuro" ? "escuro" : "claro";
}
export function readLang(): Lang {
  return localStorage.getItem(LANG_KEY) === "en" ? "en" : "pt";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "escuro");
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event(EVENT));
}
export function saveLang(lang: Lang) {
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang === "en" ? "en" : "pt";
  window.dispatchEvent(new Event(EVENT));
}

/** Preferências lidas depois da hidratação para evitar diferenças entre servidor e browser. */
export function usePreferences() {
  const [theme, setTheme] = useState<Theme>("claro");
  const [lang, setLang] = useState<Lang>("pt");
  useEffect(() => {
    const sync = () => {
      setTheme(readTheme());
      setLang(readLang());
    };
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return { theme, lang };
}

const dict = {
  pt: {
    painel: "Painel",
    planos: "Planos",
    definicoes: "Definições",
    sair: "Sair",
    admin: "Admin",
    sairTitulo: "Sair da conta?",
    sairTexto: "Tem a certeza que quer sair da sua conta? Terá de iniciar sessão novamente.",
    cancelar: "Cancelar",
    simSair: "Sim, sair",
  },
  en: {
    painel: "Dashboard",
    planos: "Plans",
    definicoes: "Settings",
    sair: "Sign out",
    admin: "Admin",
    sairTitulo: "Sign out?",
    sairTexto: "Are you sure you want to sign out? You will need to sign in again.",
    cancelar: "Cancel",
    simSair: "Yes, sign out",
  },
} as const;

export function t(lang: Lang, key: keyof (typeof dict)["pt"]) {
  return dict[lang][key];
}
