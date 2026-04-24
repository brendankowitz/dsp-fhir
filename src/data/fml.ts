export const FML: Record<string, string> = {
  condition: `map "https://dsp-fhir.org/StructureMap/DspConditionToCondition" = "DspConditionToCondition"

uses "https://dsp-fhir.org/StructureDefinition/DspConditionResource" alias DspCondition as source
uses "http://hl7.org/fhir/StructureDefinition/Condition" alias Condition as target

group DspConditionToCondition(source src : DspCondition, target tgt : Condition) {
  src.id as id -> tgt.id = id;

  src.payload as p then {
    // Primary code path: structured code+system
    p.code as c -> tgt.code as code, code.coding as coding then {
      c -> coding.code = c;
      p.code_system as sys -> coding.system = sys;
      p.display as d -> coding.display = d;
    } "code";
    // Fallback: display text only
    p.display as d -> tgt.code as code, code.text = d "display-fallback";

    // Assertion category -> verificationStatus + preserve as extension
    p.assertion as a -> tgt.extension as ext then {
      a -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-assertion-category',
           ext.value = create('code') as v, v.value = a;
    } "assertion-ext";
    p.assertion as a where (a = 'asserted' or a = 'history') -> tgt.verificationStatus as vs,
      vs.coding as co, co.system = 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
      co.code = 'confirmed' "verif-confirmed";
    p.assertion as a where a = 'denied' -> tgt.verificationStatus as vs,
      vs.coding as co, co.system = 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
      co.code = 'refuted' "verif-refuted";
    p.assertion as a where a = 'suspected' -> tgt.verificationStatus as vs,
      vs.coding as co, co.system = 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
      co.code = 'provisional' "verif-provisional";

    // Concept id hangs off the CodeableConcept
    p.concept_id as cid -> tgt.code as code, code.extension as ext then {
      cid -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-concept-id',
             ext.value = create('string') as v, v.value = cid;
    } "concept-id";
  };

  // Resource-level metadata
  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";

  src.transcript_turn_refs as t -> tgt.extension as ext,
    ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-transcript-turn-refs',
    ext.extension as turnExt, turnExt.url = 'turn',
    turnExt.value = create('integer') as v, v.value = t "turn-ref";

  src.spoken_forms as sf -> tgt.extension as ext,
    ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-spoken-forms',
    ext.value = create('string') as v, v.value = sf "spoken-form";

  // Default clinicalStatus - caller may override on ingest
  src -> tgt.clinicalStatus as cs, cs.coding as co,
    co.system = 'http://terminology.hl7.org/CodeSystem/condition-clinical',
    co.code = 'active' "clinical-default";
}`,

  medication: `map "https://dsp-fhir.org/StructureMap/DspMedicationOrderToMedicationRequest" = "DspMedicationOrderToMedicationRequest"

uses "https://dsp-fhir.org/StructureDefinition/DspOrderMedicationResource" alias DspMedOrder as source
uses "http://hl7.org/fhir/StructureDefinition/MedicationRequest" alias MedicationRequest as target

group DspMedicationOrderToMedicationRequest(source src : DspMedOrder, target tgt : MedicationRequest) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';

  src.payload as p then {
    p.drug as drug -> tgt.medication = create('CodeableConcept') as cc,
      cc.text = drug "drug-text";
    p.rxnorm_code as rx -> tgt.medication as med, med.coding as co,
      co.system = 'http://www.nlm.nih.gov/research/umls/rxnorm', co.code = rx "rxnorm";

    // Rendered sig - both extension (xver) and literal dosageInstruction.text
    p.rendered_dosage_instruction as rdi -> tgt.extension as ext then {
      rdi -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-rendered-dosage-instruction',
             ext.value = create('string') as v, v.value = rdi;
    } "rendered-sig";
    p.rendered_dosage_instruction as rdi -> tgt.dosageInstruction as di, di.text = rdi "sig-text";

    p.prn as prn -> tgt.dosageInstruction as di, di.asNeededBoolean = prn "prn";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";

  src.transcript_turn_refs as t -> tgt.extension as ext,
    ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-transcript-turn-refs',
    ext.extension as turnExt, turnExt.url = 'turn',
    turnExt.value = create('integer') as v, v.value = t "turn-ref";
}`,

  lab: `map "https://dsp-fhir.org/StructureMap/DspLabOrderToServiceRequest" = "DspLabOrderToServiceRequest"

uses "https://dsp-fhir.org/StructureDefinition/DspOrderLabResource" alias DspLabOrder as source
uses "http://hl7.org/fhir/StructureDefinition/ServiceRequest" alias ServiceRequest as target

group DspLabOrderToServiceRequest(source src : DspLabOrder, target tgt : ServiceRequest) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';
  src -> tgt.category as cat, cat.coding as co,
    co.system = 'http://terminology.hl7.org/CodeSystem/service-category',
    co.code = 'laboratory' "category";

  src.payload as p then {
    p.test as t -> tgt.code as code, code.text = t "test-text";
    p.loinc as l -> tgt.code as code, code.coding as co,
      co.system = 'http://loinc.org', co.code = l "loinc";
    p.abbreviation as ab -> tgt.extension as ext then {
      ab -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-abbreviation',
            ext.value = create('string') as v, v.value = ab;
    } "abbrev";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";
}`,

  imaging: `map "https://dsp-fhir.org/StructureMap/DspImagingOrderToServiceRequest" = "DspImagingOrderToServiceRequest"

uses "https://dsp-fhir.org/StructureDefinition/DspOrderImagingResource" alias DspImgOrder as source
uses "http://hl7.org/fhir/StructureDefinition/ServiceRequest" alias ServiceRequest as target

group DspImagingOrderToServiceRequest(source src : DspImgOrder, target tgt : ServiceRequest) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';
  src -> tgt.category as cat, cat.coding as co,
    co.system = 'http://snomed.info/sct', co.code = '363679005',
    co.display = 'Imaging' "category";

  src.payload as p then {
    p.modality as m -> tgt.extension as ext then {
      m -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-imaging-modality',
           ext.value = create('CodeableConcept') as cc, cc.text = m;
    } "modality";
    p.body_site as bs -> tgt.bodySite as bodyCc, bodyCc.text = bs "body-site";
    p.laterality as lat -> tgt.bodySite as bodyCc, bodyCc.extension as ext then {
      lat -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-bodysite-laterality',
             ext.value = create('code') as v, v.value = lat;
    } "laterality";
    p.contrast as c -> tgt.extension as ext then {
      c -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-imaging-contrast',
           ext.value = create('code') as v, v.value = c;
    } "contrast";
    p.views as v -> tgt.extension as ext,
      ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-imaging-views',
      ext.value = create('string') as vs, vs.value = v "view";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";
}`,

  procedure: `map "https://dsp-fhir.org/StructureMap/DspProcedureOrderToServiceRequest" = "DspProcedureOrderToServiceRequest"

uses "https://dsp-fhir.org/StructureDefinition/DspResource" alias DspResource as source
uses "http://hl7.org/fhir/StructureDefinition/ServiceRequest" alias ServiceRequest as target

group DspProcedureOrderToServiceRequest(source src : DspResource, target tgt : ServiceRequest) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';
  src -> tgt.category as cat, cat.coding as co,
    co.system = 'http://snomed.info/sct', co.code = '387713003',
    co.display = 'Surgical procedure' "category";

  src.payload as p then {
    p.description as d -> tgt.code as code, code.text = d "code-text";
    p.devices as dev -> tgt.extension as ext,
      ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-procedure-devices',
      ext.value = create('string') as v, v.value = dev "devices";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";
}`,

  referral: `map "https://dsp-fhir.org/StructureMap/DspReferralOrderToServiceRequest" = "DspReferralOrderToServiceRequest"

uses "https://dsp-fhir.org/StructureDefinition/DspResource" alias DspResource as source
uses "http://hl7.org/fhir/StructureDefinition/ServiceRequest" alias ServiceRequest as target

group DspReferralOrderToServiceRequest(source src : DspResource, target tgt : ServiceRequest) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';
  src -> tgt.category as cat, cat.coding as co,
    co.system = 'http://terminology.hl7.org/CodeSystem/service-category',
    co.code = 'referral' "category";

  src.payload as p then {
    p.specialty as sp -> tgt.performerType as pt, pt.text = sp "performer-type";
    p.reason as r -> tgt.reasonCode as rc, rc.text = r "reason";
    p.description as d -> tgt.code as code, code.text = d "code-text";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";
}`,

  'follow-up': `map "https://dsp-fhir.org/StructureMap/DspFollowUpOrderToServiceRequest" = "DspFollowUpOrderToServiceRequest"

uses "https://dsp-fhir.org/StructureDefinition/DspOrderFollowUpResource" alias DspFU as source
uses "http://hl7.org/fhir/StructureDefinition/ServiceRequest" alias ServiceRequest as target

group DspFollowUpOrderToServiceRequest(source src : DspFU, target tgt : ServiceRequest) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';
  src -> tgt.category as cat, cat.coding as co,
    co.system = 'https://dsp-fhir.org/CodeSystem/dsp-order-category',
    co.code = 'follow-up' "category";

  src.payload as p then {
    // Return-in Duration (+ approximation flag)
    p.return_in_value as v -> tgt.extension as ext then {
      v -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-return-in',
           ext.value = create('Duration') as dur,
           dur.value = v,
           dur.system = 'http://unitsofmeasure.org';
      p.return_in_unit as u -> dur.code = u, dur.unit = u;
      p.approximation as ap -> dur.extension as apExt,
        apExt.url = 'https://dsp-fhir.org/StructureDefinition/dsp-approximation',
        apExt.value = create('boolean') as b, b.value = ap;
    } "return-in";

    p.reason as r -> tgt.reasonCode as rc, rc.text = r "reason";
    p.prn as prn -> tgt.extension as ext then {
      prn -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-prn',
             ext.value = create('boolean') as b, b.value = prn;
    } "prn";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";
}`,

  'document-section': `map "https://dsp-fhir.org/StructureMap/DspDocumentSectionToCompositionSection" = "DspDocumentSectionToCompositionSection"

uses "https://dsp-fhir.org/StructureDefinition/DspDocumentSectionResource" alias DspSection as source
uses "http://hl7.org/fhir/StructureDefinition/Composition" alias Composition as target

// Each DSP document_section contributes one Composition.section.
// Typically called from a parent map that creates the Composition and iterates sections.

group DspDocumentSectionToCompositionSection(source src : DspSection, target tgt : Composition) {
  src -> tgt.section as sec then {
    src.payload as p then {
      p.title as t -> sec.title = t "title";
      p.section_type as st -> sec.code as c, c.coding as co,
        co.system = 'http://loinc.org', co.code = st "loinc-section";
      p.text as text -> sec.text as narr then {
        text -> narr.status = 'generated';
        text -> narr.div = text;   // wrap in XHTML <div> in controller
      } "narrative";
    };
    src.spoken_forms as sf -> sec.extension as ext,
      ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-spoken-forms',
      ext.value = create('string') as v, v.value = sf "spoken-forms";
  } "section";
}`,

  dietary: `map "https://dsp-fhir.org/StructureMap/DspDietaryOrderToNutritionOrder" = "DspDietaryOrderToNutritionOrder"

uses "https://dsp-fhir.org/StructureDefinition/DspResource" alias DspResource as source
uses "http://hl7.org/fhir/StructureDefinition/NutritionOrder" alias NutritionOrder as target

group DspDietaryOrderToNutritionOrder(source src : DspResource, target tgt : NutritionOrder) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';
  src -> tgt.dateTime = 'now';

  src.payload as p then {
    p.diet_type as dt -> tgt.oralDiet as od, od.type as t,
      t.coding as co, co.system = 'http://snomed.info/sct', co.display = dt "diet-type";
    p.restrictions as r -> tgt.excludeFoodModifier as efm, efm.text = r "restriction";
    p.instructions as i -> tgt.note as n, n.text = i "instructions";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";
}`,

  immunization: `// Routing-split map. The FML below covers the "administered" branch only;
// callers should invoke either this map or DspImmunizationOrderToImmunizationRecommendation
// based on presence of administration evidence (administered_at, lot_number, status=completed).
// Pre-splitting upstream of $transform is the IG's recommended pattern.

map "https://dsp-fhir.org/StructureMap/DspImmunizationOrderToImmunization" = "DspImmunizationOrderToImmunization"

uses "https://dsp-fhir.org/StructureDefinition/DspResource" alias DspResource as source
uses "http://hl7.org/fhir/StructureDefinition/Immunization" alias Immunization as target

group DspImmunizationOrderToImmunization(source src : DspResource, target tgt : Immunization) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'completed';

  src.payload as p then {
    p.vaccine_code as vc -> tgt.vaccineCode as v, v.coding as co,
      co.system = 'http://hl7.org/fhir/sid/cvx', co.code = vc "cvx";
    p.administered_at as at -> tgt.occurrenceDateTime = at "occurrence";
    p.lot_number as lot -> tgt.lotNumber = lot "lot";
    p.route as r -> tgt.route as rt, rt.text = r "route";
    p.site as s -> tgt.site as st, st.text = s "site";
    p.dose_number as dn -> tgt.protocolApplied as pa, pa.doseNumberPositiveInt = dn "dose";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";
}

// Recommendation branch (sketch):
// map "https://dsp-fhir.org/StructureMap/DspImmunizationOrderToImmunizationRecommendation"
//   - forecastStatus.code = 'due'
//   - dateCriterion from p.recommended_date
//   - vaccineCode[] from p.vaccine_code`,

  device: `map "https://dsp-fhir.org/StructureMap/DspDeviceOrderToDeviceRequest" = "DspDeviceOrderToDeviceRequest"

uses "https://dsp-fhir.org/StructureDefinition/DspResource" alias DspResource as source
uses "http://hl7.org/fhir/StructureDefinition/DeviceRequest" alias DeviceRequest as target

group DspDeviceOrderToDeviceRequest(source src : DspResource, target tgt : DeviceRequest) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';

  src.payload as p then {
    p.device_code as dc -> tgt.code = create('CodeableConcept') as cc,
      cc.coding as co, co.system = 'http://snomed.info/sct', co.code = dc "device-code";
    p.device_description as dd -> tgt.code as code, code.text = dd "device-text";
    p.reason as r -> tgt.reasonCode as rc, rc.text = r "reason";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";
}

// Note: R5 introduces DeviceUsage for adherence reporting. In R4 we use the
// DeviceRequest extension pattern documented in the IG (see /mapping/device).`,

  therapy: `map "https://dsp-fhir.org/StructureMap/DspTherapyOrderToServiceRequest" = "DspTherapyOrderToServiceRequest"

uses "https://dsp-fhir.org/StructureDefinition/DspResource" alias DspResource as source
uses "http://hl7.org/fhir/StructureDefinition/ServiceRequest" alias ServiceRequest as target

group DspTherapyOrderToServiceRequest(source src : DspResource, target tgt : ServiceRequest) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';
  src -> tgt.category as cat, cat.coding as co,
    co.system = 'https://dsp-fhir.org/CodeSystem/dsp-order-category',
    co.code = 'therapy' "category";

  src.payload as p then {
    p.therapy_type as tt -> tgt.code as code, code.text = tt "code-text";
    p.frequency as f -> tgt.occurrenceTiming as t, t.repeat as rep, rep.frequency = f "freq";
    p.duration_weeks as dw -> tgt.occurrenceTiming as t, t.repeat as rep,
      rep.boundsDuration as bd, bd.value = dw, bd.unit = 'wk',
      bd.system = 'http://unitsofmeasure.org', bd.code = 'wk' "duration";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";
}

// Therapy goals (if DSP emits them) are mapped separately to Goal resources,
// with Goal.addresses -> Condition and ServiceRequest.basedOn -> Goal.`,

  activity: `map "https://dsp-fhir.org/StructureMap/DspActivityOrderToCarePlan" = "DspActivityOrderToCarePlan"

uses "https://dsp-fhir.org/StructureDefinition/DspResource" alias DspResource as source
uses "http://hl7.org/fhir/StructureDefinition/CarePlan" alias CarePlan as target

// DSP ACTIVITY_ORDER -> CarePlan.activity[] (multi-item).
// For one DSP order carrying multiple items (restrictions + active tasks),
// this map produces one CarePlan with one activity per item.
// Per-activity confidence/turn-refs is not supported on activity.detail -
// when needed, emit each item as a standalone ServiceRequest and reference it
// from activity.reference (see /mapping/activity).

group DspActivityOrderToCarePlan(source src : DspResource, target tgt : CarePlan) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';

  src.payload as p then {
    p.items as item -> tgt.activity as act, act.detail as d then {
      item.activity_code as code -> d.code as c, c.coding as co,
        co.system = 'http://snomed.info/sct', co.code = code "activity-code";
      item.prohibited as proh -> d.prohibited = proh "prohibited";
      item.description as desc -> d.description = desc "desc";
      item.quantity as q -> d.quantity as qty, qty.value = q "qty";
      item.frequency_per_day as freq -> d.scheduledTiming as tt, tt.repeat as rep,
        rep.frequency = freq, rep.period = 1, rep.periodUnit = 'd' "freq";
    };
  };
}`,

  study: `// Routing-split map. Study orders with a clinical-trial registry id
// (NCT-style study_id) route to ResearchSubject+ResearchStudy; otherwise
// to ServiceRequest(category=study). This map handles the diagnostic branch.

map "https://dsp-fhir.org/StructureMap/DspStudyOrderToServiceRequest" = "DspStudyOrderToServiceRequest"

uses "https://dsp-fhir.org/StructureDefinition/DspResource" alias DspResource as source
uses "http://hl7.org/fhir/StructureDefinition/ServiceRequest" alias ServiceRequest as target

group DspStudyOrderToServiceRequest(source src : DspResource, target tgt : ServiceRequest) {
  src.id as id -> tgt.id = id;
  src -> tgt.status = 'active';
  src -> tgt.intent = 'order';
  src -> tgt.category as cat, cat.coding as co,
    co.system = 'https://dsp-fhir.org/CodeSystem/dsp-order-category',
    co.code = 'study' "category";

  src.payload as p then {
    p.study_type as st -> tgt.code as code, code.text = st "code-text";
    p.protocol as pr -> tgt.instantiatesUri = pr "protocol";
  };

  src.confidence as conf -> tgt.extension as ext then {
    conf -> ext.url = 'https://dsp-fhir.org/StructureDefinition/dsp-confidence-score',
            ext.value = create('decimal') as v, v.value = conf;
  } "confidence";
}

// Research enrollment branch (sketch):
// map "https://dsp-fhir.org/StructureMap/DspStudyOrderToResearchSubject"
//   - ResearchSubject.study -> ResearchStudy(identifier=NCT...)
//   - ResearchSubject.status = 'candidate'`,
};
