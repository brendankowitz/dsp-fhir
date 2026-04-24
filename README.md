# DSP ⇄ FHIR

An opinionated analysis and implementation-guide sketch mapping Microsoft's [Dragon Standard Payload (DSP)](https://learn.microsoft.com/en-us/industry/healthcare/dragon-copilot/sdk/partner-apis/dragon-data-exchange/dragon-standard-payload/) 1.0 onto HL7 FHIR as the canonical interoperability model.

**Live site:** <https://brendankowitz.github.io/dsp-fhir/>

## What's here

- FHIR R4 vs R5 vs R6 evaluation with cross-version extension strategy
- `$graphql`-first canonical read contract with REST / `$everything` fallbacks
- Side-by-side mapping pages for all 15 DSP resource types (orders, conditions, document sections)
- DSP-FHIR implementation guide sketch: profiles, extensions, normative rules R1–R4
- Audit of custom operations against base FHIR + IPS, US Core, Bulk Data, HRex, Subscription Backport
- Terminology appendix (canonical URLs) and end-to-end worked example

## Local dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Deployment

GitHub Pages, built by `.github/workflows/deploy.yml` on every push to `main`.

## Disclaimer

Not affiliated with Microsoft or HL7. Independent analysis based on the public DSP specification.
