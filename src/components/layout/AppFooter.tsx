export function AppFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-center text-xs leading-relaxed text-slate-400">
      <p>
        This material is unofficial and is not endorsed by Supercell. See{" "}
        <a
          href="https://supercell.com/en/fan-content-policy/"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-slate-200"
        >
          Supercell&apos;s Fan Content Policy
        </a>
        .
      </p>
      <p className="mt-1">
        Draft statistics shown are a seeded demo dataset for development, not real match data. This app
        never reads or controls Brawl Stars &mdash; it is advisory only.
      </p>
    </footer>
  );
}
