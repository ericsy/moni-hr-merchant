import { useLocale } from "../context/LocaleContext";

export default function Home() {
  const { t } = useLocale();

  return (
    <div className="flex min-h-[calc(100vh-112px)] items-center justify-center">
      <h1 className="text-2xl font-semibold text-foreground">{t.home.welcome}</h1>
    </div>
  );
}
