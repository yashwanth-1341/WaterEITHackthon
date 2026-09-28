"""Generate the ILLUSTRATIVE SYNTHETIC MineWater Passport dataset.

All sites, operators and numbers are fictional. Magnitudes are chosen to be
plausible for the mine type / processing route, but no record describes a real
mine. Basin-stress scores are illustrative placeholders, NOT looked up from WRI
Aqueduct.

Outputs (deterministic):
  data/sites.json             - array of passports conforming to the schema
  data/sites_kpis.csv         - flat table of normalised KPIs
  prototype/data/sites.js     - same records for the offline web app
  prototype/data/schema.js    - the JSON Schema for the offline web app

Run:  python data/generate_synthetic.py
"""
from __future__ import annotations

import csv
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "framework" / "mine-water-passport.schema.json"

random.seed(20260928)

BWS_CAT = [(1, "low"), (2, "low_medium"), (3, "medium_high"), (4, "high"), (5.01, "extremely_high")]
STRESS_WEIGHT = {"low": 0.1, "low_medium": 0.3, "medium_high": 0.5, "high": 0.8,
                 "extremely_high": 1.0, "arid_low_water_use": 1.0}


def cat_for(score: float) -> str:
    for lim, name in BWS_CAT:
        if score < lim:
            return name
    return "extremely_high"


# Data-quality flags follow the site's metering maturity (deterministic):
#   good   = flows metered, consumption calculated from the balance
#   mixed  = large flows metered, small ones estimated
#   poor   = mostly estimated
#   design = project stage, design-basis calculations
MODELLED = {"precipitation_runoff", "ore_entrainment"}


def dq_flow(profile: str, subtype: str | None = None, share: float = 1.0) -> str:
    if profile == "good":
        return "calculated" if subtype in MODELLED else "measured"
    if profile == "mixed":
        if subtype in MODELLED:
            return "estimated"
        return "measured" if share >= 0.3 else "estimated"
    if profile == "poor":
        return "calculated" if share >= 0.6 else "estimated"
    return "calculated" if share >= 0.5 else "estimated"


def dq_derived(profile: str) -> str:
    return {"good": "calculated", "mixed": "calculated", "poor": "estimated", "design": "estimated"}[profile]


def dq_meter(profile: str) -> str:
    return {"good": "measured", "mixed": "calculated", "poor": "estimated", "design": "calculated"}[profile]


# ---------------------------------------------------------------- site specs
# withdrawals: (source, subtype, quality, freshwater_gri, share)
SITES = [
    dict(id="MWP-CL-0001", name="Cerro Andino Copper", op="Andino Minerals S.A. (fictional)", cc="CL",
         lat=-23.62, lon=-68.94, com="Cu", mt="open_pit", pr=["flotation"], life="operating",
         basin="Atacama coastal-range basin (illustrative)", bws=4.8, tier="tier2", dqp="good", ass="limited",
         meth="ICMM_2021", ore=45_000_000,
         products=[("Cu", "Cu concentrate", 880_000, 245_500, "contained_metal", 1.0)],
         W=27_000, wd=[("seawater", "desalinated_seawater", "cat3", False, .45), ("groundwater", "bore_field", "cat1", True, .40),
                       ("groundwater", "mine_dewatering", "cat2", False, .08), ("groundwater", "ore_entrainment", "cat2", False, .065),
                       ("surface_water", "precipitation_runoff", "cat1", True, .005)],
         D=[("third_party", "cat2", True, 420)], dS=380, cmix=(.55, .40, .05), task=1.9, reuse=.78, tsf=.55, err=0.0,
         users=["agriculture", "indigenous_communities", "ecosystems_wetlands", "other_mining"], season="moderate",
         griev=2, inc=0, seas_amp=.12, monthly=True),
    dict(id="MWP-CL-0002", name="Pampa Roja Copper", op="Pampa Roja SpA (fictional)", cc="CL",
         lat=-22.41, lon=-68.72, com="Cu", mt="open_pit", pr=["heap_leach_sx_ew"], life="operating",
         basin="Loa river basin (illustrative)", bws=4.9, tier="tier2", dqp="mixed", ass="limited", meth="ICMM_2021",
         ore=22_000_000, products=[("Cu", "Cu cathode", 78_000, 78_000, "contained_metal", 1.0)],
         W=3_300, wd=[("groundwater", "bore_field", "cat1", True, .85), ("groundwater", "mine_dewatering", "cat2", False, .15)],
         D=[], dS=190, cmix=(.72, .25, .03), task=2.4, reuse=.6, tsf=0, err=0.0,
         users=["agriculture", "indigenous_communities", "ecosystems_wetlands"], season="moderate", griev=4, inc=1,
         seas_amp=.2, monthly=True),
    dict(id="MWP-CL-0003", name="Salar Ventisca Lithium", op="Ventisca Litio Ltda. (fictional)", cc="CL",
         lat=-23.71, lon=-68.31, com="Li", mt="brine", pr=["brine_evaporation"], life="operating",
         basin="Endorheic salar basin (illustrative)", bws=4.5, bwscat="arid_low_water_use", tier="tier2", dqp="mixed",
         ass="limited", meth="MCA_WAF_2_0", brine=38_000_000,
         products=[("Li", "Li2CO3", 45_000, 45_000, "LCE", 1.0)],
         W=38_750, wd=[("groundwater", "brine", "cat3", False, 38_000 / 38_750), ("groundwater", "bore_field", "cat1", True, 750 / 38_750)],
         D=[], dS=610, cmix=(.95, .04, .01), task=1.05, reuse=.05, tsf=0, err=0.0,
         users=["indigenous_communities", "ecosystems_wetlands", "agriculture"], season="moderate", griev=5, inc=0,
         seas_amp=.35, monthly=True),
    dict(id="MWP-AR-0004", name="Puna Alta DLE Lithium", op="Puna Alta Litio S.A. (fictional)", cc="AR",
         lat=-24.18, lon=-66.72, com="Li", mt="brine", pr=["direct_lithium_extraction"], life="operating",
         basin="Puna endorheic basin (illustrative)", bws=4.5, bwscat="arid_low_water_use", tier="tier2", dqp="good",
         ass="reasonable", meth="MCA_WAF_2_0", brine=25_000_000,
         products=[("Li", "Li2CO3", 25_000, 25_000, "LCE", 1.0)],
         W=25_420, wd=[("groundwater", "brine", "cat3", False, 25_000 / 25_420), ("groundwater", "bore_field", "cat1", True, 420 / 25_420)],
         D=[("groundwater", "cat3", False, 22_500)], dS=100, cmix=(.55, .35, .10), task=1.4, reuse=.45, tsf=0, err=0.0,
         users=["indigenous_communities", "ecosystems_wetlands"], season="moderate", griev=1, inc=0, seas_amp=.1, monthly=True),
    dict(id="MWP-PE-0005", name="Quebrada Sol Copper", op="Minera Quebrada Sol S.A.C. (fictional)", cc="PE",
         lat=-17.12, lon=-70.58, com="Cu", mt="open_pit", pr=["flotation"], life="operating",
         basin="Pacific slope river basin (illustrative)", bws=4.2, tier="tier2", dqp="mixed", ass="limited", meth="GRI_303_2018",
         ore=30_000_000, products=[("Cu", "Cu concentrate", 420_000, 116_100, "contained_metal", 0.92),
                                   ("other", "Mo concentrate", 6_000, 2_900, "contained_metal", 0.08)],
         W=21_000, wd=[("surface_water", "river_lake_abstraction", "cat1", True, .55), ("groundwater", "bore_field", "cat1", True, .30),
                       ("surface_water", "precipitation_runoff", "cat1", True, .05), ("groundwater", "ore_entrainment", "cat2", False, .10)],
         D=[("surface_water", "cat2", True, 3_500)], dS=-150, cmix=(.35, .58, .07), task=2.6, reuse=.72, tsf=.5, err=0.0,
         users=["agriculture", "municipal_drinking", "indigenous_communities"], season="strong", griev=9, inc=2,
         seas_amp=.3, monthly=True),
    dict(id="MWP-AU-0006", name="Red Ridge Spodumene", op="Red Ridge Lithium Pty Ltd (fictional)", cc="AU",
         lat=-31.22, lon=119.81, com="Li", mt="open_pit", pr=["dense_media_separation", "flotation"], life="operating",
         basin="Inland drainage division (illustrative)", bws=2.4, tier="tier2", dqp="good", ass="reasonable", meth="MCA_WAF_2_0",
         ore=4_500_000, products=[("Li", "Spodumene concentrate (SC6)", 600_000, 78_000, "LCE", 1.0)],
         W=4_200, wd=[("groundwater", "mine_dewatering", "cat3", False, .60), ("groundwater", "bore_field", "cat2", False, .30),
                      ("surface_water", "precipitation_runoff", "cat1", True, .10)],
         D=[], dS=100, cmix=(.45, .50, .05), task=2.2, reuse=.62, tsf=.4, err=0.0,
         users=["agriculture", "ecosystems_wetlands"], season="moderate", griev=0, inc=0, seas_amp=.15, monthly=True),
    dict(id="MWP-AU-0007", name="Tallawong Nickel", op="Tallawong Resources Pty Ltd (fictional)", cc="AU",
         lat=-28.61, lon=121.93, com="Ni", mt="underground", pr=["flotation"], life="operating",
         basin="Salt-lake palaeodrainage (illustrative)", bws=2.8, tier="tier2", dqp="good", ass="limited", meth="MCA_WAF_2_0",
         ore=2_200_000, products=[("Ni", "Ni concentrate", 210_000, 29_900, "contained_metal", 0.95),
                                  ("Co", "in Ni concentrate", 0, 700, "contained_metal", 0.05)],
         W=2_600, wd=[("groundwater", "mine_dewatering", "cat3", False, .70), ("groundwater", "bore_field", "cat2", False, .25),
                      ("third_party", "municipal_supply", "cat1", True, .05)],
         D=[("groundwater", "cat3", False, 250)], dS=50, cmix=(.5, .45, .05), task=1.8, reuse=.55, tsf=.35, err=0.0,
         users=["ecosystems_wetlands", "other_mining"], season="none", griev=0, inc=0, seas_amp=.05, monthly=True),
    dict(id="MWP-AU-0008", name="Gibber Plains Copper-Gold", op="Gibber Plains Mining Pty Ltd (fictional)", cc="AU",
         lat=-30.58, lon=136.71, com="Cu", mt="underground", pr=["flotation", "smelting_refining"], life="operating",
         basin="Artesian-fed arid basin (illustrative)", bws=3.4, tier="tier2", dqp="good", ass="reasonable", meth="ICMM_2021",
         ore=10_000_000, products=[("Cu", "Cu cathode", 162_000, 162_000, "contained_metal", 0.85),
                                   ("Au", "Au dore", 3.2, 3.2, "contained_metal", 0.15)],
         W=11_500, wd=[("groundwater", "bore_field", "cat1", True, .70), ("groundwater", "bore_field", "cat3", False, .25),
                       ("surface_water", "precipitation_runoff", "cat1", True, .05)],
         D=[], dS=250, cmix=(.40, .55, .05), task=2.0, reuse=.66, tsf=.45, err=0.0,
         users=["agriculture", "ecosystems_wetlands", "indigenous_communities"], season="none", griev=1, inc=0,
         seas_amp=.08, monthly=True),
    dict(id="MWP-SE-0009", name="Norrberg Copper", op="Norrberg Koppar AB (fictional)", cc="SE",
         lat=67.02, lon=20.84, com="Cu", mt="open_pit", pr=["flotation"], life="operating",
         basin="Boreal river catchment (illustrative)", bws=0.4, tier="tier2", dqp="good", ass="reasonable", meth="ICMM_2021",
         ore=42_000_000, products=[("Cu", "Cu concentrate", 330_000, 83_200, "contained_metal", 0.8),
                                   ("Au", "in Cu concentrate", 0, 2.1, "contained_metal", 0.2)],
         W=28_000, wd=[("surface_water", "precipitation_runoff", "cat1", True, .55), ("surface_water", "river_lake_abstraction", "cat1", True, .25),
                       ("groundwater", "mine_dewatering", "cat2", False, .20)],
         D=[("surface_water", "cat2", True, 21_500)], dS=500, cmix=(.15, .80, .05), task=3.0, reuse=.85, tsf=.6, err=0.0,
         users=["ecosystems_wetlands", "indigenous_communities", "hydropower"], season="strong", griev=1, inc=0,
         seas_amp=.55, monthly=True, north=True),
    dict(id="MWP-FI-0010", name="Kivijarvi Nickel", op="Kivijarvi Metals Oy (fictional)", cc="FI",
         lat=63.91, lon=28.24, com="Ni", mt="open_pit", pr=["bioheap_leach"], life="operating",
         basin="Lake-district catchment (illustrative)", bws=0.3, tier="tier2", dqp="good", ass="limited", meth="GRI_303_2018",
         ore=13_000_000, products=[("Ni", "Mixed sulphide precipitate", 75_000, 30_000, "contained_metal", 0.70),
                                   ("Zn", "ZnS precipitate", 110_000, 60_000, "contained_metal", 0.25),
                                   ("Co", "in MSP", 0, 900, "contained_metal", 0.05)],
         W=9_500, wd=[("surface_water", "precipitation_runoff", "cat1", True, .60), ("surface_water", "river_lake_abstraction", "cat1", True, .30),
                      ("groundwater", "mine_dewatering", "cat2", False, .10)],
         D=[("surface_water", "cat2", True, 7_400)], dS=300, cmix=(.35, .55, .10), task=2.5, reuse=.7, tsf=.3, err=0.0,
         users=["ecosystems_wetlands", "tourism"], season="strong", griev=3, inc=2, seas_amp=.5, monthly=True, north=True),
    dict(id="MWP-AT-0011", name="Alpenglanz Lithium (project)", op="Alpenglanz Lithium GmbH (fictional)", cc="AT",
         lat=46.88, lon=14.93, com="Li", mt="underground", pr=["dense_media_separation", "flotation"], life="construction",
         basin="Alpine tributary catchment (illustrative)", bws=1.4, tier="tier2", dqp="design", ass="none", meth="ICMM_2021",
         ore=800_000, products=[("Li", "Spodumene concentrate (design)", 100_000, 10_000, "LCE", 1.0)],
         W=350, wd=[("groundwater", "mine_dewatering", "cat2", False, .70), ("third_party", "municipal_supply", "cat1", True, .10),
                    ("surface_water", "precipitation_runoff", "cat1", True, .20)],
         D=[("surface_water", "cat2", True, 180)], dS=10, cmix=(.20, .70, .10), task=2.0, reuse=.7, tsf=.5, err=0.0,
         users=["municipal_drinking", "tourism", "ecosystems_wetlands", "agriculture"], season="moderate", griev=0, inc=0,
         seas_amp=.3, monthly=True, north=True),
    dict(id="MWP-PT-0012", name="Serra Clara Lithium (project)", op="Serra Clara Litio Lda. (fictional)", cc="PT",
         lat=41.71, lon=-7.63, com="Li", mt="open_pit", pr=["dense_media_separation", "flotation"], life="construction",
         basin="Upper Douro-type catchment (illustrative)", bws=3.1, tier="tier1", dqp="design", ass="none", meth="company_specific",
         ore=1_500_000, products=[("Li", "Spodumene/petalite concentrate (design)", 170_000, 14_000, "LCE", 1.0)],
         W=900, wd=[("surface_water", "river_lake_abstraction", "cat1", True, .50), ("surface_water", "precipitation_runoff", "cat1", True, .30),
                    ("groundwater", "mine_dewatering", "cat2", False, .20)],
         D=[("surface_water", "cat2", True, 150)], dS=0, cmix=(.3, .6, .1), task=2.0, reuse=.6, tsf=.4, err=0.0,
         users=["agriculture", "municipal_drinking", "ecosystems_wetlands"], season="strong", griev=7, inc=0,
         seas_amp=.45, monthly=False, north=True),
    dict(id="MWP-RS-0013", name="Drina Valley Lithium-Borate (project)", op="Drina Valley Minerals d.o.o. (fictional)", cc="RS",
         lat=44.52, lon=19.21, com="Li", mt="underground", pr=["agitated_leach_sx_ew"], life="construction",
         basin="Sava tributary catchment (illustrative)", bws=2.2, tier="tier1", dqp="design", ass="none", meth="company_specific",
         ore=1_200_000, products=[("Li", "Li2CO3 (design)", 18_000, 18_000, "LCE", 0.7),
                                  ("other", "Boric acid (design)", 150_000, 150_000, "contained_metal", 0.3)],
         W=1_100, wd=[("groundwater", "mine_dewatering", "cat2", False, .60), ("surface_water", "river_lake_abstraction", "cat1", True, .40)],
         D=[("surface_water", "cat2", True, 700)], dS=10, cmix=(.3, .6, .1), task=1.8, reuse=.5, tsf=.3, err=0.0,
         users=["agriculture", "municipal_drinking"], season="moderate", griev=11, inc=0, seas_amp=.3, monthly=False, north=True),
    dict(id="MWP-CD-0014", name="Kalemba Copper-Cobalt", op="Kalemba Mining SARL (fictional)", cc="CD",
         lat=-10.71, lon=25.52, com="Cu", mt="open_pit", pr=["agitated_leach_sx_ew"], life="operating",
         basin="Upper Congo headwater catchment (illustrative)", bws=1.3, tier="tier1", dqp="poor", ass="internal_review",
         meth="company_specific", ore=6_000_000,
         products=[("Cu", "Cu cathode", 120_000, 120_000, "contained_metal", 0.75), ("Co", "Co hydroxide", 34_000, 12_000, "contained_metal", 0.25)],
         W=14_000, wd=[("surface_water", "river_lake_abstraction", "cat1", True, .40), ("groundwater", "mine_dewatering", "cat2", False, .45),
                       ("surface_water", "precipitation_runoff", "cat1", True, .15)],
         D=[("surface_water", "cat2", False, 8_000)], dS=400, cmix=(.3, .6, .1), task=1.6, reuse=.35, tsf=.2, err=0.07,
         users=["agriculture", "municipal_drinking", "indigenous_communities"], season="strong", griev=14, inc=3,
         seas_amp=.5, monthly=False),
    dict(id="MWP-CD-0015", name="Lufira Cobalt", op="Lufira Cobalt SARL (fictional)", cc="CD",
         lat=-11.38, lon=27.31, com="Co", mt="open_pit", pr=["agitated_leach_sx_ew"], life="operating",
         basin="Lufira sub-catchment (illustrative)", bws=1.6, tier="tier1", dqp="poor", ass="none", meth="company_specific",
         ore=1_800_000, products=[("Co", "Co hydroxide", 22_000, 8_000, "contained_metal", 0.8), ("Cu", "Cu cathode", 12_000, 12_000, "contained_metal", 0.2)],
         W=3_800, wd=[("surface_water", "river_lake_abstraction", "cat1", True, .70), ("groundwater", "mine_dewatering", "cat2", False, .30)],
         D=[("surface_water", "cat2", False, 1_500)], dS=0, cmix=(.3, .6, .1), task=1.4, reuse=.2, tsf=0, err=0.066,
         users=["agriculture", "municipal_drinking"], season="strong", griev=8, inc=2, seas_amp=.5, monthly=False, sparse=True),
    dict(id="MWP-ES-0016", name="Sierra Morena Copper-Zinc", op="Minas Sierra Morena S.L. (fictional)", cc="ES",
         lat=37.71, lon=-6.62, com="Cu", mt="open_pit_and_underground", pr=["flotation"], life="operating",
         basin="Guadiana-type Mediterranean basin (illustrative)", bws=4.1, tier="tier2", dqp="mixed", ass="limited", meth="GRI_303_2018",
         ore=5_500_000, products=[("Cu", "Cu concentrate", 240_000, 60_000, "contained_metal", 0.7),
                                  ("Zn", "Zn concentrate", 140_000, 70_000, "contained_metal", 0.3)],
         W=4_800, wd=[("surface_water", "precipitation_runoff", "cat1", True, .45), ("groundwater", "mine_dewatering", "cat3", False, .35),
                      ("third_party", "treated_wastewater", "cat2", False, .20)],
         D=[("surface_water", "cat2", True, 1_900)], dS=-100, cmix=(.35, .6, .05), task=2.3, reuse=.7, tsf=.45, err=0.0,
         users=["agriculture", "municipal_drinking", "ecosystems_wetlands"], season="strong", griev=3, inc=1,
         seas_amp=.5, monthly=True, north=True),
    dict(id="MWP-ID-0017", name="Teluk Biru Nickel HPAL", op="PT Teluk Biru Nikel (fictional)", cc="ID",
         lat=-2.94, lon=122.18, com="Ni", mt="open_pit", pr=["hpal"], life="operating",
         basin="Tropical coastal catchment (illustrative)", bws=0.6, tier="tier1", dqp="mixed", ass="limited", meth="GRI_303_2018",
         ore=8_000_000, products=[("Ni", "Mixed hydroxide precipitate", 150_000, 60_000, "contained_metal", 0.88),
                                  ("Co", "in MHP", 0, 6_000, "contained_metal", 0.12)],
         W=30_000, wd=[("seawater", "seawater_direct", "cat3", False, .60), ("surface_water", "river_lake_abstraction", "cat1", True, .30),
                       ("surface_water", "precipitation_runoff", "cat1", True, .10)],
         D=[("seawater", "cat3", True, 24_000)], dS=200, cmix=(.3, .6, .1), task=1.5, reuse=.3, tsf=.1, err=0.0,
         users=["indigenous_communities", "ecosystems_wetlands", "agriculture"], season="moderate", griev=6, inc=2,
         seas_amp=.2, monthly=True),
]


def r1(x: float) -> float:
    return round(x, 1)


def build(s: dict) -> dict:
    tier2 = s["tier"] == "tier2"
    p = s["dqp"]
    W = s["W"]
    withdrawals = []
    for src, sub, q, fresh, share in s["wd"]:
        w = {"source": src, "volume_ml": r1(W * share), "dq": dq_flow(p, sub, share)}
        if tier2 or random.random() < 0.5:
            w["subtype"] = sub
        if tier2 or not s.get("sparse"):
            w["quality"] = q
            w["freshwater_gri"] = fresh
        withdrawals.append(w)
    W_real = sum(w["volume_ml"] for w in withdrawals)
    discharges = []
    for dest, q, treated, vol in s["D"]:
        d = {"destination": dest, "volume_ml": r1(vol), "dq": dq_meter(p) if p != "mixed" else "measured", "treated": treated}
        if tier2 or not s.get("sparse"):
            d["quality"] = q
        discharges.append(d)
    D = sum(d["volume_ml"] for d in discharges)
    C_true = W_real - D - s["dS"]
    C_rep = C_true - s["err"] * W_real  # deliberate reporting gap (share of withdrawal) for some sites
    noise = {"good": 0.004, "mixed": 0.015, "poor": 0.02, "design": 0.0}[p]
    C_rep += random.uniform(-noise, noise) * W_real  # realistic small closure residuals
    e, n, o = s["cmix"]
    consumption = {"total_ml": r1(C_rep), "total_dq": dq_derived(p)}
    if tier2:
        consumption.update({
            "evaporation_ml": r1(C_rep * e), "evaporation_dq": dq_derived(p),
            "entrainment_ml": r1(C_rep * n), "entrainment_dq": dq_derived(p),
            "other_ml": r1(C_rep * o), "other_dq": "estimated",
        })
        # fix rounding so components sum to total
        consumption["other_ml"] = r1(consumption["total_ml"] - consumption["evaporation_ml"] - consumption["entrainment_ml"])
    task = W_real * s["task"]
    reuse = {"reused_recycled_ml": r1(task * s["reuse"]), "dq": dq_meter(p)}
    if tier2:
        reuse["task_water_ml"] = r1(task)
        reuse["tsf_return_ml"] = r1(task * s["reuse"] * s["tsf"])
    water = {"withdrawals": withdrawals, "discharges": discharges, "consumption": consumption, "reuse": reuse}
    if tier2 or s["dS"]:
        opening = round(random.uniform(800, 6000), 0)
        water["storage"] = {"opening_ml": opening, "closing_ml": opening + s["dS"], "dq": dq_meter(p)}
    if s["monthly"]:
        peak = 7 if s.get("north") else 1
        fac = [1 + s["seas_amp"] * math.cos(2 * math.pi * (m - peak) / 12) for m in range(1, 13)]
        tot = sum(fac)
        water["monthly"] = [{
            "month": m,
            "withdrawal_ml": r1(W_real * fac[m - 1] / tot),
            "consumption_ml": r1(C_rep * fac[m - 1] / tot),
            "discharge_ml": r1(D * (2 - fac[m - 1]) / (24 - tot)) if D else 0.0,
        } for m in range(1, 13)]

    products = []
    for com, form, pt, mt, basis, alloc in s["products"]:
        pr = {"commodity": com, "product_form": form, "metal_content_t": mt, "basis": basis, "allocation_share": alloc}
        if pt:
            pr["product_t"] = pt
        products.append(pr)
    production = {"products": products}
    if "ore" in s:
        production["ore_processed_t"] = s["ore"]
    if "brine" in s:
        production["brine_processed_m3"] = s["brine"]

    bcat = s.get("bwscat") or cat_for(s["bws"])
    rec = {
        "passport_version": "0.1",
        "synthetic": True,
        "tier": s["tier"],
        "site": {
            "site_id": s["id"], "name": s["name"], "operator": s["op"], "country": s["cc"],
            "latitude": s["lat"], "longitude": s["lon"], "primary_commodity": s["com"],
            "mine_type": s["mt"], "processing_route": s["pr"], "lifecycle_stage": s["life"],
            "basin": {"name": s["basin"], "bws_score": s["bws"], "bws_category": bcat,
                      "bws_source": "Illustrative placeholder - production system looks up WRI Aqueduct 4.0 from coordinates"},
        },
        "period": {"year": 2025, "start_date": "2025-01-01", "end_date": "2025-12-31"},
        "production": production,
        "water": water,
        "assurance": {"level": s["ass"], "methodology": s["meth"]},
        "sources": [{"title": "Synthetic demo record (generate_synthetic.py)", "extraction": "reported_directly"}],
    }
    if s["ass"] in ("limited", "reasonable"):
        rec["assurance"]["provider"] = "Example Assurance Partner (fictional)"
    if tier2 or not s.get("sparse"):
        rec["context"] = {"competing_users": s["users"], "seasonality": s["season"],
                          "water_grievances": s["griev"], "water_incidents": s["inc"]}
    return rec


def kpis(rec: dict) -> dict:
    w = rec["water"]
    W = sum(x["volume_ml"] for x in w["withdrawals"])
    fresh = sum(x["volume_ml"] for x in w["withdrawals"] if x.get("quality") == "cat1")
    D = sum(x["volume_ml"] for x in w.get("discharges", []))
    C = w["consumption"]["total_ml"]
    st = w.get("storage")
    dS = (st["closing_ml"] - st["opening_ml"]) if st else 0
    resid = W - D - C - dS
    prod = rec["production"]
    ore = prod.get("ore_processed_t")
    prim = rec["site"]["primary_commodity"]
    pm = next((p for p in prod["products"] if p["commodity"] == prim), prod["products"][0])
    alloc = pm.get("allocation_share", 1.0)
    cat = rec["site"]["basin"]["bws_category"]
    return {
        "site_id": rec["site"]["site_id"], "name": rec["site"]["name"], "country": rec["site"]["country"],
        "latitude": rec["site"]["latitude"], "longitude": rec["site"]["longitude"],
        "primary_commodity": prim, "mine_type": rec["site"]["mine_type"],
        "processing_route": "+".join(rec["site"]["processing_route"]), "tier": rec["tier"], "year": rec["period"]["year"],
        "ore_processed_t": ore or "", "brine_processed_m3": prod.get("brine_processed_m3", ""),
        "primary_metal_t": pm["metal_content_t"], "metal_basis": pm["basis"],
        "withdrawal_ml": r1(W), "cat1_withdrawal_ml": r1(fresh), "discharge_ml": r1(D), "consumption_ml": r1(C),
        "delta_storage_ml": r1(dS), "reused_recycled_ml": w["reuse"]["reused_recycled_ml"],
        "bws_score": rec["site"]["basin"]["bws_score"], "bws_category": cat,
        "withdrawal_m3_per_t_ore": round(W * 1000 / ore, 3) if ore else "",
        "consumption_m3_per_t_ore": round(C * 1000 / ore, 3) if ore else "",
        "consumption_m3_per_t_primary_metal": round(C * 1000 * alloc / pm["metal_content_t"], 1),
        "stress_weighted_consumption_ml": r1(C * STRESS_WEIGHT[cat]),
        "balance_residual_pct": round(100 * resid / W, 2) if W else "",
        "assurance": rec["assurance"]["level"], "synthetic": True,
    }


def main() -> None:
    recs = [build(s) for s in SITES]
    (ROOT / "data" / "sites.json").write_text(json.dumps(recs, indent=2), encoding="utf-8")
    rows = [kpis(r) for r in recs]
    with open(ROOT / "data" / "sites_kpis.csv", "w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    out = ROOT / "prototype" / "data"
    out.mkdir(parents=True, exist_ok=True)
    (out / "sites.js").write_text(
        "/* ILLUSTRATIVE SYNTHETIC DATA - fictional sites, generated by data/generate_synthetic.py */\n"
        "window.MWP_SITES = " + json.dumps(recs) + ";\n", encoding="utf-8")
    (out / "schema.js").write_text(
        "/* MineWater Passport JSON Schema v0.1 (copy of framework/mine-water-passport.schema.json) */\n"
        "window.MWP_SCHEMA = " + json.dumps(schema) + ";\n", encoding="utf-8")
    print(f"wrote {len(recs)} synthetic passports")


if __name__ == "__main__":
    main()
