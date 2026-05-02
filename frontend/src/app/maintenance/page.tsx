import Link from "next/link";
import { Outfit } from "next/font/google";
import { useTranslations } from "next-intl";

const outfit = Outfit({ subsets: ["latin"] });

export default function MaintenancePage() {
  const t = useTranslations("maintenance");
  return (
    <main className={`min-h-[80vh] flex flex-col items-center justify-center p-4 ${outfit.className}`}>
      <div className="glass-card max-w-2xl w-full p-8 md:p-12 flex flex-col items-center text-center space-y-8 animate-fade-in-stable">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20 shadow-[0_0_30px_rgba(200,146,42,0.15)] mb-4">
          <span className="font-nom text-5xl md:text-6xl text-accent-gold select-none">
            流
          </span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-text-primary">
            {t("title")}
          </h1>
          <p className="text-lg md:text-xl text-text-secondary max-w-md mx-auto leading-relaxed">
            {t("body")}
          </p>
        </div>

        <div className="pt-4 w-full max-w-xs flex flex-col space-y-3">
          <Link
            href="/"
            className="w-full py-4 px-6 bg-accent-primary hover:bg-accent-hover text-white font-semibold rounded-xl transition-stable shadow-lg shadow-accent-primary/20 flex items-center justify-center"
          >
            {t("tryRefresh")}
          </Link>
          <a
            href="mailto:support@nomflow.com"
            className="w-full py-3 px-6 text-text-secondary hover:text-text-primary transition-stable text-sm"
          >
            {t("contactSupport")}
          </a>
        </div>

        <div className="pt-8 border-t border-white/5 w-full flex flex-col items-center space-y-2">
          <p className="text-xs text-text-secondary/60 uppercase tracking-widest font-medium">
            {t("tagline")}
          </p>
          <p className="text-xs text-text-secondary/60">
            {t.rich("partOf", {
              accent: (chunks) => (
                <span className="text-accent-primary">{chunks}</span>
              ),
            })}
          </p>
        </div>
      </div>
    </main>
  );
}
