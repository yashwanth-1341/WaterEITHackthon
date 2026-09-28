import Link from "next/link";
import rawCorpus from "@/lib/data/corpus.json";
import type { Corpus } from "@/lib/corpus/types";
import { Series } from "@/lib/corpus/series";
import { companyProfiles } from "@/lib/corpus/indicators";
import { integritySignals } from "@/lib/corpus/integrity";
import { computeFacts } from "@/lib/corpus/foresight";
import { HORIZONS, NOW_YEAR } from "@/lib/corpus/trends";
import TrendChart, { type TrendRow } from "./TrendChart";

const corpus = rawCorpus as Corpus;

function data() {
  const series = new Series(corpus);
  const profiles = companyProfiles(corpus, series);
  const signals = integritySignals(corpus);
  const f = computeFacts(corpus, profiles, signals);
  const g = f.withdrawalChange ?? 0;
  const rows: TrendRow[] = [];
  for (let y = f.baseYear; y <= HORIZONS[3].year; y++) {
    const expected = 100 * (1 + g) ** (y - f.baseYear);
    const atNow = 100 * (1 + g) ** (NOW_YEAR - f.baseYear);
    rows.push({ year: y, expected, desired: y <= NOW_YEAR ? expected : atNow * 0.97 ** (y - NOW_YEAR) });
  }
  const countries = new Set(corpus.sites.map((s) => s.country).filter(Boolean)).size;
  return { f, rows, countries, sites: corpus.sites.length };
}

const pct1 = (x: number | null) => (x === null ? "–" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`);

export default function Landing() {
  const { f, rows, countries } = data();
  const idx10 = Math.round(f.withdrawalIndex["10y"] ?? 0);

  return (
    <div className="bg-paper text-basalt">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-fresh-3/95 text-white backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6" aria-label="Main">
          <Link href="/" className="flex items-center gap-2 text-[1.15rem] font-bold tracking-tight semi-cond">
            <Drop className="h-5 w-5 text-sea" /> AquaTrace
          </Link>
          <div className="hidden items-center gap-6 text-[0.88rem] text-white/80 md:flex">
            <a href="#problem" className="hover:text-white">The problem</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#findings" className="hover:text-white">Findings</a>
            <a href="#actions" className="hover:text-white">What to do</a>
          </div>
          <Link href="/explore" className="rounded-md bg-white px-3.5 py-2 text-[0.85rem] font-semibold text-fresh-3 transition-colors hover:bg-sea">
            Explore the data
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-fresh-3 text-white">
        <Contours className="pointer-events-none absolute -right-40 -top-20 h-[42rem] w-[42rem] text-white/[0.07]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
          <p className="rise text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-sea">Mine water intelligence</p>
          <h1 className="rise rise-2 mt-4 max-w-3xl text-[2.3rem] leading-[1.08] font-bold tracking-tight semi-cond sm:text-[3.4rem]">
            See where mining&apos;s water goes, and whether the numbers add up.
          </h1>
          <p className="rise rise-3 mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-white/80 sm:text-[1.15rem]">
            AquaTrace reads the water reports mining companies already publish, puts them on one scale, checks every figure, and shows what
            happens next if nothing changes.
          </p>
          <div className="rise rise-3 mt-8 flex flex-wrap gap-3">
            <Link href="/explore" className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-[0.95rem] font-semibold text-fresh-3 transition-colors hover:bg-sea">
              Explore the data <Arrow className="h-4 w-4" />
            </Link>
            <a href="#findings" className="inline-flex items-center rounded-md border border-white/30 px-5 py-3 text-[0.95rem] font-medium text-white transition-colors hover:border-white">
              See the findings
            </a>
          </div>

          <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-white/15 pt-8 sm:grid-cols-4">
            <HeroStat value={`${f.companies}`} label="mining companies" />
            <HeroStat value={`${countries}`} label="countries" />
            <HeroStat value={f.figures.toLocaleString("en-US")} label="figures, each traced to its page" />
            <HeroStat value={`${f.firstYear}–${f.lastYear}`} label="years of published reports" />
          </dl>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead kicker="The problem" title="Water is becoming the limit on mining. The data about it is not ready." />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <ProblemCard icon={<Sun className="h-6 w-6" />} title="Metals come from dry places">
            Much of the world&apos;s copper, gold and battery metal is mined in basins that are already short of water, from the Atacama to Western
            Australia. Demand is rising.
          </ProblemCard>
          <ProblemCard icon={<Files className="h-6 w-6" />} title="Every report looks different">
            Each company uses its own tables, units and definitions. Only {f.stressDisclosed} of {f.companies} say how much water they take from
            water-stressed areas.
          </ProblemCard>
          <ProblemCard icon={<Alert className="h-6 w-6" />} title="Nobody checks the numbers">
            {f.companiesWithHigh} of {f.companies} companies publish at least one figure that doesn&apos;t add up: more water out than in, parts bigger
            than the whole, silent changes between years.
          </ProblemCard>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 border-y border-hairline bg-limestone">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHead kicker="How it works" title="Three steps from scattered reports to a clear answer" />
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            <Step n={1} title="Collect" icon={<Layers className="h-5 w-5" />}>
              Reads PDFs and spreadsheets from each company and converts every water figure to one unit, megalitres. Each number keeps a link to
              the page or cell it came from.
            </Step>
            <Step n={2} title="Check" icon={<Shield className="h-5 w-5" />}>
              Fingerprints every source file so a swapped report is caught. Tests whether each site&apos;s water balances, whether totals add up and
              whether past figures were quietly changed.
            </Step>
            <Step n={3} title="Explain" icon={<Chart className="h-5 w-5" />}>
              Shows the trend for each company and the industry, where it leads in 2, 5 and 10 years, and what companies can do to change course.
            </Step>
          </ol>
        </div>
      </section>

      {/* Findings */}
      <section id="findings" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead kicker="What the data shows" title="Water use is still going up, and recycling has stopped improving" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.35fr] lg:items-center">
          <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
            <Finding value={pct1(f.withdrawalChange)} tone="bad" label="a year: the median change in water withdrawn" detail={`${f.withdrawalGrowing} of ${f.withdrawalCompanies} companies with several years of data are taking more water, not less.`} />
            <Finding value={f.reuseLatestMedian === null ? "–" : `${Math.round(f.reuseLatestMedian)}%`} tone="neutral" label="of water is reused" detail={`The median reuse share is slipping ${Math.abs(f.reuseChangePts ?? 0).toFixed(1)} points a year instead of rising.`} />
            <Finding value={`${f.companiesWithHigh}/${f.companies}`} tone="bad" label="companies with numbers that don't add up" detail="Found by automatic checks. A reason to ask, not proof of wrongdoing." />
          </div>
          <div className="rounded-xl border border-hairline bg-white p-5 shadow-[0_1px_2px_rgba(30,42,47,0.06)] sm:p-6">
            <h3 className="text-[1rem] font-semibold">Where the industry is heading</h3>
            <p className="mt-1 text-[0.85rem] text-shale">
              If nothing changes, the index reaches {idx10} by {HORIZONS[3].year}. With steady action it falls instead.
            </p>
            <div className="mt-4">
              <TrendChart rows={rows} nowYear={NOW_YEAR} />
            </div>
          </div>
        </div>
      </section>

      {/* Risks timeline */}
      <section className="bg-basalt text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHead dark kicker="The risk if nothing changes" title="What happens to companies that wait" />
          <ol className="mt-12 grid gap-8 md:grid-cols-4">
            <Risk when="Today" year={HORIZONS[0].year}>
              Water risk is priced by guesswork. Buyers and lenders can&apos;t tell a careful operator from a careless one.
            </Risk>
            <Risk when="In 2 years" year={HORIZONS[1].year}>
              New rules and battery-metal buyers ask for site-level proof. No verified data, no contract.
            </Risk>
            <Risk when="In 5 years" year={HORIZONS[2].year}>
              Dry regions cap or reprice water rights. Expansions stall on water permits, and costs jump where desalination is the only option.
            </Risk>
            <Risk when="In 10 years" year={HORIZONS[3].year}>
              Hard limits in the driest basins. Output that depends on freshwater is cut, and conflict over water threatens the licence to operate.
            </Risk>
          </ol>
        </div>
      </section>

      {/* Actions */}
      <section id="actions" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead kicker="What companies should do" title="Five actions that change the trend" />
        <ol className="mt-10 grid gap-4 md:grid-cols-2">
          <Action n={1} title="Measure, don't estimate">Meter water in and out at every site. Estimates hide both problems and progress.</Action>
          <Action n={2} title="Report every site, in one format">Use the ICMM standard, and state how much comes from water-stressed areas.</Action>
          <Action n={3} title="Make the balance close">Water in should equal water out, used and stored. Fix sites where it doesn&apos;t.</Action>
          <Action n={4} title="Flag and explain every change">When a past figure is restated or a method changes, say so and say why.</Action>
          <Action n={5} title="Cut water per tonne, starting in dry basins" wide>
            Recycle more, move to thickened or dry-stacked tailings, and plan now for caps on freshwater where water is scarcest.
          </Action>
        </ol>
      </section>

      {/* Audiences */}
      <section className="border-t border-hairline bg-limestone">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHead kicker="Who it's for" title="One set of numbers, three ways to read it" />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Audience href="/explore?view=trends" title="Mining companies" cta="See your trend">
              Compare your sites and peers, find the figures that won&apos;t survive an audit, and see your exposure in 2, 5 and 10 years.
            </Audience>
            <Audience href="/explore?view=benchmark" title="Investors and buyers" cta="Compare companies">
              Rank companies on water per tonne, recycling, stressed-area exposure and how far their data can be trusted.
            </Audience>
            <Audience href="/explore?view=government" title="Regulators" cta="See by country">
              See every disclosed site by country, which sites sit in stressed areas, and which gaps a reporting rule could close.
            </Audience>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-fresh-3 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[1.8rem] leading-tight font-bold tracking-tight semi-cond sm:text-[2.2rem]">Start with the numbers.</h2>
            <p className="mt-2 max-w-xl text-white/80">
              {f.companies} companies, {f.figures.toLocaleString("en-US")} figures, every one traceable. Pick a company, or ask a question in plain
              English.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/explore" className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 font-semibold text-fresh-3 transition-colors hover:bg-sea">
              Explore the data <Arrow className="h-4 w-4" />
            </Link>
            <Link href="/explore?view=ask" className="inline-flex items-center rounded-md border border-white/30 px-5 py-3 font-medium transition-colors hover:border-white">
              Ask a question
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-[0.78rem] leading-relaxed text-shale sm:px-6">
        Built from {f.reports} public sustainability reports, GRI indexes and CDP water responses ({f.firstYear}–{f.lastYear}). Projections extend
        disclosed trends and are not forecasts. Consistency signals are prompts for review, not findings of wrongdoing.{" "}
        <Link href="/ledger" className="text-fresh underline underline-offset-2">
          Open the single-site ledger
        </Link>
        .
      </footer>
    </div>
  );
}

/* ---------- pieces ---------- */

function SectionHead({ kicker, title, dark }: { kicker: string; title: string; dark?: boolean }) {
  return (
    <div className="max-w-3xl">
      <p className={`text-[0.78rem] font-semibold uppercase tracking-[0.14em] ${dark ? "text-sea" : "text-fresh"}`}>{kicker}</p>
      <h2 className="mt-3 text-[1.75rem] leading-[1.15] font-bold tracking-tight text-balance semi-cond sm:text-[2.3rem]">{title}</h2>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="num cond text-[2rem] leading-none font-bold sm:text-[2.4rem]">{value}</dd>
      <dd className="mt-1.5 text-[0.85rem] text-white/70">{label}</dd>
    </div>
  );
}

function ProblemCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-white p-6 shadow-[0_1px_2px_rgba(30,42,47,0.06)]">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-oxide/10 text-oxide" aria-hidden>
        {icon}
      </div>
      <h3 className="mt-4 text-[1.1rem] font-semibold">{title}</h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-shale">{children}</p>
    </div>
  );
}

function Step({ n, title, icon, children }: { n: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="relative">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fresh text-white" aria-hidden>
          {icon}
        </span>
        <span className="text-[0.8rem] font-semibold tracking-wide text-shale">STEP {n}</span>
      </div>
      <h3 className="mt-4 text-[1.25rem] font-semibold">{title}</h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-shale">{children}</p>
    </li>
  );
}

function Finding({ value, label, detail, tone }: { value: string; label: string; detail: string; tone: "bad" | "neutral" }) {
  return (
    <div className="border-l-4 pl-4" style={{ borderColor: tone === "bad" ? "var(--color-oxide)" : "var(--color-fresh)" }}>
      <div className="num cond text-[2.6rem] leading-none font-bold">{value}</div>
      <div className="mt-1 text-[0.95rem] font-semibold">{label}</div>
      <p className="mt-1 text-[0.85rem] leading-relaxed text-shale">{detail}</p>
    </div>
  );
}

function Risk({ when, year, children }: { when: string; year: number; children: React.ReactNode }) {
  return (
    <li className="border-t-2 border-oxide pt-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[1.05rem] font-semibold">{when}</span>
        <span className="num text-[0.8rem] text-white/50">{year}</span>
      </div>
      <p className="mt-2 text-[0.92rem] leading-relaxed text-white/75">{children}</p>
    </li>
  );
}

function Action({ n, title, children, wide }: { n: number; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <li className={`flex gap-4 rounded-xl border border-hairline bg-white p-5 ${wide ? "md:col-span-2" : ""}`}>
      <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf/10 text-[0.95rem] font-bold text-leaf" aria-hidden>
        {n}
      </span>
      <div>
        <h3 className="text-[1.05rem] font-semibold">{title}</h3>
        <p className="mt-1 text-[0.92rem] leading-relaxed text-shale">{children}</p>
      </div>
    </li>
  );
}

function Audience({ href, title, cta, children }: { href: string; title: string; cta: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex flex-col rounded-xl border border-hairline bg-white p-6 transition-shadow hover:shadow-[0_6px_20px_rgba(30,42,47,0.10)]">
      <h3 className="text-[1.15rem] font-semibold">{title}</h3>
      <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-shale">{children}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-fresh">
        {cta} <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/* ---------- icons (inline SVG, stroke style) ---------- */

type IconProps = { className?: string };
const Svg = ({ className, children }: IconProps & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);
const Drop = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.7 6.3 9.3a7 7 0 1 0 11.4 0L12 2.7Z" />
  </Svg>
);
const Arrow = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
const Sun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);
const Files = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V6l-4-4Z" />
    <path d="M15 2v4h4M3 7v13a2 2 0 0 0 2 2h9" />
  </Svg>
);
const Alert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);
const Layers = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 2 10 5-10 5L2 7l10-5Z" />
    <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
  </Svg>
);
const Shield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
const Chart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3v18h18" />
    <path d="m7 15 4-4 3 3 5-6" />
  </Svg>
);
/** Decorative contour lines, like a basin map. */
const Contours = ({ className }: IconProps) => (
  <svg viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth={1.2} className={className} aria-hidden>
    {[40, 70, 100, 130, 160, 190].map((r, i) => (
      <path key={r} d={`M ${200 - r} 200 C ${200 - r} ${200 - r * 0.8}, ${200 + r * 0.9} ${200 - r * 1.05}, ${200 + r} ${200 - r * 0.1} S ${200 + r * 0.2} ${200 + r * 1.1}, ${200 - r} 200`} opacity={1 - i * 0.1} />
    ))}
  </svg>
);
