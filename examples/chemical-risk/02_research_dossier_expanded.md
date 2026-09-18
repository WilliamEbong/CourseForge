# Laboratory Chemical Risk, Incident Investigation, and CAPA
## Expanded Research Dossier — Version 2

**Research date:** 17 September 2026  
**Primary jurisdiction:** Canada, with workplace-law emphasis on Alberta  
**Purpose:** Evidence base for a later instructional course for educated, nontechnical professionals in laboratory operations, biotechnology, healthcare, research, quality, safety, compliance, administration, and project coordination  
**Status:** Research dossier only. Not a course, storyboard, certification program, legal opinion, emergency-response procedure, industrial-hygiene assessment, medical recommendation, or substitute for institution-specific procedures.

---

# 1. Scope, evidence hierarchy, and how to use this dossier

This dossier addresses laboratory chemical risk from receipt of a hazardous product through storage, use, task-specific risk assessment, exposure control, emergency response, incident investigation, corrective action, preventive action, and effectiveness review. It is deliberately written at a level deeper than the eventual learner-facing course so that later instructional-design work can simplify without losing regulatory or technical meaning.

The research uses a five-level evidence hierarchy:

1. **Legislation / regulation — enforceable where applicable.**  
   Examples: the federal *Hazardous Products Act* (HPA), *Hazardous Products Regulations* (HPR), Alberta *Occupational Health and Safety Act* and Alberta *Occupational Health and Safety Code*.

2. **Government interpretation and guidance — authoritative but not itself legislation unless incorporated by law.**  
   Examples: Health Canada WHMIS guidance, Alberta OHS handbooks and CCOHS guidance.

3. **Management-system and international guidance.**  
   Examples: ISO 45001, WHO Laboratory Quality Management System, and the UN Globally Harmonized System of Classification and Labelling of Chemicals (GHS).

4. **Peer-reviewed evidence.**  
   Used mainly for reporting culture, human factors, laboratory safety culture, and underreporting.

5. **Research synthesis / good practice.**  
   Recommendations built by combining the sources above. These are explicitly identified as good practice rather than presented as law.

The primary legal question throughout is **“What does Alberta law require of the workplace?”** The primary practical question is **“What system would allow a laboratory to identify, control, learn from, and reduce chemical risk?”** Those are related but not identical questions.

---

# 2. Executive summary

A laboratory chemical-safety system fails when it treats hazard information as if it were a complete risk assessment. WHMIS tells workers and employers important things about the intrinsic properties of hazardous products. It does not determine whether a particular task is acceptably controlled. The actual risk depends on the material, concentration, quantity, physical state, route of exposure, process energy, duration, frequency, equipment, ventilation, worker proximity, incompatible materials, abnormal conditions, and reliability of controls.

Canada’s WHMIS system is divided between **federal supplier law** and **provincial/territorial workplace law**. Health Canada administers the HPA/HPR, which govern how suppliers classify hazardous products and provide labels and SDSs. Provinces and territories implement workplace WHMIS duties. In Alberta, the OHS Act and Code govern employer, supervisor, worker, hazard-assessment, training, exposure-control, emergency-planning, label, SDS, incident-reporting, and investigation duties. [HC-WHMIS-RR; HPA-13; HPA-14; AB-OHS-3; AB-OHS-2; AB-OHS-4; AB-OHS-7; AB-OHS-29]

At the federal level, the HPA prohibits sale or import of a hazardous product intended for workplace use unless the supplier has/provides a compliant SDS and the product/container has a compliant label, subject to statutory exceptions. The HPR contain the detailed classification and communication rules. The HPR consolidation reviewed for this dossier was current to 21 July 2026 and last amended 15 December 2022. [HPA-13; HPA-14; HPR]

WHMIS is aligned with the UN GHS, but WHMIS is **not simply “the GHS.”** GHS is an international model for hazard classification and communication. Governments decide what revisions and classes to implement through domestic law. UNECE identifies **GHS Rev. 11 (2025)** as the most recent GHS edition as of this research date, while Canadian obligations remain those actually enacted in the HPA/HPR. [UNECE-GHS11; HC-WHMIS-GUIDE]

Alberta law goes beyond hazard communication. OHS Code Part 2 requires the employer to identify existing and potential hazards before work begins, document the assessment and controls, record the date, repeat the assessment at specified triggers, involve affected workers, and follow a hierarchy of elimination/control. Engineering controls are preferred where reasonably practicable; if they do not adequately eliminate/control the hazard, administrative controls and then PPE are used, including combinations where they provide greater safety. [AB-OHS-2 ss.7–10]

Part 4 is particularly important for laboratories. It requires exposure to listed harmful substances to be kept as low as reasonably achievable and below applicable occupational exposure limits (OELs), addresses combined exposures and extended shifts, specifies recognized methods for compliance air monitoring, requires competent persons to perform such measurements, requires assessment and exposure-minimizing procedures where workers may be exposed to harmful substances, and establishes immediate actions after overexposure. It also requires immediate access to emergency baths/showers/eyewash or other equipment appropriate to the potential exposure when chemicals harmful to eyes or skin are used. [AB-OHS-4 ss.16–24]

Part 29 implements workplace WHMIS in Alberta. It covers training, hazardous waste, supplier and work-site labels, decanted products, placards, laboratory samples, employer-prepared SDSs, SDS currency, and worker access. A common laboratory misconception is that every transferred container is automatically exempt if it is “only temporary.” Alberta’s specific decanting exception requires that all product be for immediate use, remain under the exclusive control of the worker who filled it, be used during that shift, and be clearly identified. Otherwise, a work-site label is required unless another specific provision applies. [AB-OHS-29 s.400]

Laboratory-specific WHMIS variations must be taught narrowly. CCOHS explains that supplier containers of 100 mL or less may omit hazard and precautionary statements from the supplier label, while the SDS still carries the complete hazard statements. Containers of 3 mL or less can use label arrangements that permit removal during normal use where an attached label would interfere, subject to the HPR conditions. A federal “laboratory sample” is not merely any sample in a laboratory: HPR s.5 defines it as less than 10 kg, intended solely to be tested in a laboratory, with exclusions including material used by the laboratory to test other products and material for educational/demonstration use. [CCOHS-LABS; HPR-5]

The SDS is a regulatory communication document, not a task-specific safe-work procedure. Under the HPR, SDSs use a 16-section format. CCOHS emphasizes that SDS information can be too general for workplace-specific decisions, such as respirator selection or unusual use conditions. The competent risk assessor must therefore connect Sections 2, 7, 8, 9, 10 and 11 to the actual laboratory operation. [CCOHS-SDS]

A strong chemical inventory is not just a list of bottles. It should function as the laboratory’s **hazard-information and lifecycle control layer**, linking product identity, owner, location, quantity, concentration/form, storage class, SDS revision, receipt/opening dates, review triggers, restrictions, status, and waste/disposal state. CCOHS describes an up-to-date laboratory product inventory as good practice. The more detailed inventory schema developed in this dossier is synthesis, not a claim that Alberta prescribes those exact fields. [CCOHS-LABS]

Emergency response and investigation are separate phases. During a spill, exposure, uncontrolled reaction, equipment failure, or injury, life safety and preventing escalation come first. Alberta Code Part 7 requires an emergency response plan for emergencies that may require rescue or evacuation, affected-worker involvement, currency, and defined plan content. Investigation should begin after immediate hazards are controlled. [AB-OHS-7 ss.115–118]

Alberta OHS Act s.33 establishes important reporting and investigation boundaries. Specified serious injuries/illnesses/incidents must be reported to a Director as soon as possible. The employer or prime contractor must investigate reportable events and also investigate an incident that had a likelihood of causing serious injury/illness where corrective action may be needed. Investigation reports have specified content, distribution, availability and a two-year retention requirement. For reportable events, the scene must not be disturbed except for defined safety/property-protection reasons unless directed otherwise by an authorized official. [AB-OHS-ACT-33]

A credible investigation does not stop at “worker error.” CCOHS explicitly advises investigators to consider task, material, environment, personnel, and management factors and warns that a conclusion of carelessness may fail to reveal correctable causes. Methods such as timeline analysis, 5 Whys, fishbone analysis, barrier analysis, change analysis, and fault-tree analysis are tools for structuring inquiry; none proves causation by itself. [CCOHS-INVEST]

“CAPA” is not a universal legal requirement in every laboratory context. It is a formal quality-system concept in regulated sectors. Health Canada’s current Natural Health Products GMP guide, GUI-0158 Version 4, published 4 September 2025 and effective 4 March 2026, is a useful regulated example. It describes issue documentation, immediate correction/containment, root-cause investigation, impact evaluation, corrective and preventive actions, resources/timelines, effectiveness monitoring, and closure. Those elements are transferable as good management practice, but their regulatory force depends on the applicable sector. [HC-CAPA; HC-GMP-V4]

Finally, safety metrics can become counterproductive if they reward low reporting rather than low risk. CCOHS recommends balancing leading and lagging indicators. A 2023 systematic review found substantial occupational injury/illness underreporting and identified fear, cumbersome processes, poor reporting knowledge, normalization of injury, poor psychosocial environment, and distrust of consequences as contributors. Other research has linked poor safety climate and disciplinary/incentive pressures to lower reporting. [CCOHS-INDICATORS; KYUNG-2023; PROBST-2008; LIPSCOMB-2013]

---

# 3. Terminology and conceptual model

## 3.1 Hazard

A **hazard** is an intrinsic source or situation with the potential to cause harm. Examples include corrosivity, acute toxicity, sensitization, flammability, reactivity, pressure, cryogenic temperature, or the ability to generate respirable dust.

The key teaching distinction is:

> **Hazard describes what can cause harm. Risk describes the chance and consequence of harm under defined conditions.**

A sealed 100 mL bottle of corrosive liquid and an open, heated transfer of several litres may involve the same chemical hazard but very different risk.

## 3.2 Exposure

**Exposure** is contact between a person and a harmful agent through a relevant route. In laboratory chemical work, common routes include:

- inhalation of vapour, gas, aerosol, dust, mist, smoke or decomposition products;
- eye contact;
- skin contact and possible dermal absorption;
- ingestion, usually secondary to contamination;
- injection or percutaneous exposure from sharps, broken glass or pressurized systems.

Exposure has dimensions: concentration or dose, duration, frequency, timing, peak versus average exposure, and affected body surface/route.

## 3.3 Risk

**Risk** is the combined consideration of likelihood and consequence under the actual conditions of work. A risk rating is a decision aid, not a physical property of the chemical.

A useful conceptual model is:

> **Intrinsic hazard + amount/form + task conditions + exposure opportunity + control reliability + abnormal conditions = task risk**

This model is preferable to a simplistic “hazard rating × probability” approach when training nontechnical professionals because it directs attention to the variables that actually change laboratory risk.

## 3.4 Consequence / severity

**Consequence** is the credible magnitude of harm if the exposure or event occurs. Consequences can include:

- reversible irritation;
- chemical burn;
- sensitization;
- systemic toxicity;
- chronic organ damage;
- reproductive or developmental harm;
- cancer;
- fire or explosion injury;
- asphyxiation;
- pressure injury;
- property damage;
- environmental release;
- serious injury or fatality.

Severity should be based on credible outcomes, not only the outcome that happened last time.

## 3.5 Likelihood

**Likelihood** is the chance that the relevant event or exposure will occur under specified conditions. It should consider:

- task frequency;
- number of workers exposed;
- duration of exposure opportunity;
- equipment failure probability;
- human-machine interface;
- actual work practices;
- control effectiveness and reliability;
- known deviations;
- abnormal/startup/shutdown conditions;
- history of similar near misses;
- uncertainty.

## 3.6 Incident

An **incident** is an undesired event that caused or could have caused harm, loss, damage, release, interruption or another adverse outcome. Organizations define the term differently, so a local reporting policy should define what workers are expected to report.

## 3.7 Near miss / close call

A **near miss** is an event where serious harm did not occur but could credibly have occurred.

Alberta OHS legislation does not depend on the workplace’s internal label “near miss.” Section 33(5) creates an investigation duty when an incident had a likelihood of causing a serious injury or illness and there is reasonable cause to believe corrective action may be needed to prevent recurrence. [AB-OHS-ACT-33(5)]

That distinction is important. Calling something a “near miss” internally does not determine whether the statutory investigation test is met.

## 3.8 Nonconformity

A **nonconformity** is failure to meet a requirement. The requirement may come from:

- legislation;
- a licence or permit;
- a quality standard;
- an approved SOP;
- a specification;
- a validation protocol;
- an internal policy;
- a contract;
- a customer/regulatory commitment.

The term is especially common in quality systems.

## 3.9 Deviation

A **deviation** is a departure from an approved or expected procedure, process, parameter, method, condition, or specification. In regulated quality systems, deviations normally require documented assessment and disposition. The exact definition is system-specific.

## 3.10 Correction

A **correction** fixes the immediate detected problem.

Examples:
- replacing an illegible label;
- updating an incorrect inventory location;
- repairing a broken interlock;
- removing a damaged chemical container from service under the site procedure.

Correction addresses **the present condition**, not necessarily why it happened.

## 3.11 Containment

**Containment** is interim action that limits spread, exposure or impact while investigation and permanent action proceed.

Examples:
- taking equipment out of service;
- quarantining affected material;
- temporarily restricting access;
- suspending a process;
- adding an interim review or approval step.

Health Canada’s CAPA guidance explicitly distinguishes immediate correction/containment from the later causal and preventive work. [HC-CAPA]

## 3.12 Corrective action

A **corrective action** addresses the cause or causes of a detected problem so recurrence becomes less likely.

It should answer:

- Which causal mechanism is this action intended to interrupt?
- Why should it work?
- How will we know it was implemented?
- How will we know it was effective?

## 3.13 Preventive action

A **preventive action** addresses a credible potential problem or the same failure mode elsewhere before it causes another event.

In some modern management systems, preventive thinking is embedded in risk-based planning rather than maintained as a separate CAPA category. Therefore, the course should teach the concept without implying that every organization must maintain a field literally called “Preventive Action.”

## 3.14 Root cause

A **root cause** is an underlying causal factor whose correction meaningfully reduces recurrence risk.

The term should not imply that every incident has one unique deepest cause. CCOHS states that even apparently straightforward incidents seldom have only one cause. [CCOHS-INVEST]

## 3.15 Contributing factor

A **contributing factor** increased the likelihood or consequence of an incident but may not be sufficient by itself to explain the event.

Example: an unclear label, rushed handover and poorly segregated waste station may all contribute to one incompatible-waste near miss.

## 3.16 Effectiveness check

An **effectiveness check** is a planned evaluation after implementation to determine whether the action achieved the intended control objective without creating unacceptable new problems.

An effectiveness check is different from:
- verifying that the action was completed;
- confirming that a document was revised;
- confirming that training attendance was recorded.

The question is not “Did we do the CAPA?” but “Did the CAPA solve the problem?”

---

# 4. Canadian WHMIS and Alberta OHS framework

## 4.1 Federal supplier law: HPA and HPR

The HPA and HPR regulate hazardous products intended for workplace use at the supplier level.

**HPA s.13** prohibits sale of a hazardous product intended for workplace use unless the supplier has a compliant SDS, provides it on sale when possession/ownership transfers, and ensures the product/container has a compliant label, subject to applicable exceptions. [HPA-13]

**HPA s.14** imposes analogous requirements on importers. [HPA-14]

The HPR define:
- hazard classes and classification criteria;
- required label elements;
- SDS content;
- supplier identifiers;
- exceptions/variations;
- laboratory-sample provisions;
- significant-new-data updating rules.

The HPR consolidation located during this research was current to **21 July 2026**, with the last amendment dated **15 December 2022**. [HPR]

### Significant new data

HPR s.5.12 defines significant new data as new hazard information that changes classification or changes the ways to protect against the hazard. Supplier updating obligations operate on specific timelines: Health Canada summarizes these as **90 days for SDS updates and 180 days for label updates**, with interim communication requirements where the updated document is not yet complete. [HPR-5.12; HC-WHMIS-GUIDE]

This matters because the old WHMIS habit of asking whether an SDS is “less than three years old” is not the correct modern federal rule. Currency is driven by current information and significant new data.

## 4.2 WHMIS and GHS: related but not identical

The UN GHS is a model system for:
- classifying chemical hazards;
- label elements;
- SDS structure;
- harmonized hazard communication.

UNECE identifies **GHS Rev. 11, published in 2025**, as the current edition in 2026. [UNECE-GHS11]

WHMIS uses GHS-based concepts, but Canadian law determines which provisions apply in Canada. Therefore:

- a GHS pictogram is not independently a Canadian legal requirement unless incorporated into Canadian requirements;
- an SDS prepared for another country may not automatically satisfy Canadian requirements;
- a newer GHS edition does not automatically amend WHMIS.

## 4.3 Alberta employer duties

Alberta’s OHS framework establishes workplace responsibilities.

OHS Act s.3 requires employers, as far as reasonably practicable, to ensure worker health and safety and includes duties relating to awareness, competent supervision, resolution of concerns, and adequate training. Section 3(2) requires adequate training in matters necessary to perform work in a healthy and safe manner. [AB-OHS-3]

OHS Code Part 2 then provides the core hazard-management process. [AB-OHS-2]

### Formal hazard assessment: s.7

Employer must:
- assess the work site and identify existing and potential hazards before work begins;
- prepare a report of the results and control/elimination methods;
- record the date;
- repeat the assessment at reasonably practicable intervals and when specified changes occur.

Explicit reassessment triggers include:
- new work process;
- changed work process or operation;
- significant additions/alterations to the work site. [AB-OHS-2 s.7]

### Worker participation: s.8

Affected workers must be involved in the hazard assessment and control/elimination of identified hazards. [AB-OHS-2 s.8]

### Hazard elimination/control: s.9

The sequence is:
- eliminate the hazard if possible;
- where reasonably practicable, eliminate/control using engineering controls;
- if not adequately controlled at that level, use administrative controls;
- if still not adequately controlled, use appropriate PPE;
- use combinations if that gives greater protection. [AB-OHS-2 s.9]

### Emergency control: s.10

Where emergency action is required to correct a dangerous condition, only competent workers and the minimum number necessary may be exposed, and reasonable efforts must be made to control the hazard during correction. [AB-OHS-2 s.10]

## 4.4 Worker participation through committees and representatives

The OHS Act requires a joint health and safety committee for employers regularly employing 20 or more workers and a health and safety representative for employers regularly employing 5–19 workers, subject to the Act’s conditions and work-site structure. Committee duties include receiving concerns, participating in hazard assessment, making recommendations and reviewing inspection documentation. [AB-OHS-JHSC ss.13–14]

This is relevant to laboratory operations because Part 29 also requires consultation with the JHSC/representative, where present, when developing WHMIS procedures specified in s.397. [AB-OHS-29 s.397]

## 4.5 Alberta workplace WHMIS: Part 29

Part 29 applies to hazardous products at a work site subject to listed exceptions. Important subsections for laboratories include:

### s.396 — hazardous waste

Hazardous waste generated at the work site must be safely stored and handled using an appropriate means of identification plus worker instruction. [AB-OHS-29 s.396]

### s.397 — training

Workers who work with or near hazardous products or manufacture them must be trained in:
- supplier/work-site label content and significance;
- SDS content and significance;
- procedures for safe storage/use/handling;
- manufacturing procedures where applicable;
- identification methods used for certain systems;
- fugitive-emission procedures;
- emergency procedures.

The employer must develop and implement specified procedures in consultation with the JHSC or representative, where one exists. [AB-OHS-29 s.397]

### s.398 — label required

A hazardous product/container generally requires a supplier or work-site label. Supplier labels must not be removed/altered while product remains in the original container, subject to the legislation. If the supplier label becomes illegible or detached, it must be replaced immediately by another supplier label or a work-site label. [AB-OHS-29 s.398]

### s.400 — decanted products

A work-site label is required when a hazardous product is decanted into another container unless all immediate-use conditions are satisfied.

The portable-container exception requires:
1. all product is required for immediate use;
2. it remains under the control of and is used exclusively by the worker who filled it;
3. it is used only during that shift;
4. the contents are clearly identified. [AB-OHS-29 s.400]

This is a useful instructional example because “temporary container” by itself is not the legal test.

### s.403 — laboratory samples

Alberta provides specific workplace label variations for qualifying laboratory samples connected to HPR s.5 exemptions, and additional exemptions from s.400 for certain laboratory-only analytical/testing/evaluation containers where identification and training requirements are met. [AB-OHS-29 s.403]

### ss.404–407 — SDS acquisition, employer SDSs, currency and availability

- Employer acquiring a hazardous product generally must obtain the supplier SDS unless the supplier is exempt.  
- A hazardous product may be stored without a supplier SDS for no more than 120 days while the employer is actively seeking it.  
- An employer producing/manufacturing a hazardous product at the work site generally prepares an SDS, subject to listed exceptions.  
- Employer must ensure the SDS received at purchase is the most current version.  
- Where significant new data are provided by the supplier, the employer must update the SDS as soon as reasonably practicable and no later than 90 days.  
- Required SDSs must be readily available to workers who may be exposed and to the JHSC/representative, if one exists. [AB-OHS-29 ss.404–407]

## 4.6 Alberta chemical exposure framework: Part 4

Part 4 should receive more attention in a laboratory course than generic WHMIS instruction often gives it.

### s.16 — worker exposure

For substances in Schedule 1 Table 2:
- exposure must be kept **as low as reasonably achievable**;
- listed OELs must not be exceeded;
- ceiling limits cannot be exceeded;
- where no Alberta OEL is established for a harmful substance present at the work site, exposure must still be kept as low as reasonably achievable. [AB-OHS-4 s.16]

### s.17 — multiple substances

Where workers are exposed to multiple listed substances with similar modes of toxic action in one shift, Alberta prescribes a combined-exposure calculation. [AB-OHS-4 s.17]

Instructional implication: “Every substance is below its individual OEL” is not always sufficient when toxicological effects are additive.

### s.18 — shifts longer than eight hours

The Code requires adjustment of the 8-hour exposure limit for longer shifts, subject to exceptions and permitted alternative scientifically recognized methods approved by a Director. [AB-OHS-4 s.18]

### s.20 — airborne concentration measurement

Where measurement is used for OEL compliance:
- recognized analytical methods must be used;
- direct-reading instruments can be used under specified circumstances;
- the person conducting airborne measurements must be competent;
- results must be recorded and kept for three years. [AB-OHS-4 s.20]

### s.21 — potential worker exposure

If a worker may be exposed to a harmful substance:
- employer must identify health hazards;
- assess worker exposure;
- establish procedures to minimize exposure;
- inform worker about hazards and measurement results;
- train worker in those procedures;
- worker must use the procedures and apply the training. [AB-OHS-4 s.21]

### s.22 — overexposure

If exposure exceeds the OEL, the employer must immediately:
- identify the cause;
- protect the worker from further exposure;
- control the situation to protect others;
- explain the nature and extent of the overexposure to the worker.

The JHSC/representative, if present, must be informed in writing as soon as reasonably practicable. [AB-OHS-4 s.22]

### ss.23–24 — decontamination and emergency washing

Where workers may be contaminated, suitable decontamination facilities are required. Where chemicals harmful to eyes or skin are used, workers must have immediate access at the work site to emergency baths, showers, eyewash or other equipment appropriate to the potential level of exposure. [AB-OHS-4 ss.23–24]

### s.26 — code of practice

For substances/processes listed in Schedule 1 Table 1, a formal code of practice is required when specified amount/concentration thresholds are exceeded. The code must address storage, handling, use and disposal, uncontrolled-release prevention and response. Table 1 includes substances such as benzene, beryllium, cadmium, ethylene oxide, hydrazines, hydrogen sulphide, isocyanates, lead compounds and others. [AB-OHS-4 s.26; AB-OHS-SCH1]

### s.27 — storage

A harmful substance must be clearly identified and used/stored so that use or storage is not a hazard to workers. [AB-OHS-4 s.27]

## 4.7 Emergency preparedness: Part 7

Where an emergency may require rescue or evacuation, employer must establish a current emergency response plan and involve affected workers. Required plan content includes:
- potential emergencies;
- response procedures;
- emergency equipment/PPE and operating procedures;
- training;
- emergency facilities;
- fire protection;
- alarms/communication;
- first aid;
- rescue/evacuation;
- designated rescue/evacuation workers. [AB-OHS-7 ss.115–116]

Designated rescue/evacuation workers require appropriate training and exercises sufficient to maintain competence. [AB-OHS-7 s.117]

---

# 5. Laboratory-specific WHMIS provisions and variations

## 5.1 Small containers

CCOHS summarizes current supplier-label variations:

**100 mL or less:** hazard statements and precautionary statements may be omitted from the supplier label; full statements remain in SDS Section 2. [CCOHS-LABS]

**3 mL or less:** where a fixed label interferes with normal use, the label can be designed to be removable during use while remaining durable and legible during storage/transport, subject to the HPR rules. [CCOHS-LABS]

Teaching implication: a tiny vial is not “unlabelled because it is small.” Small-container rules modify requirements; they do not erase hazard communication.

## 5.2 Decanted products

A good laboratory rule of thumb is:
> If the material leaves the direct, immediate, same-shift control of the person who filled the container, assume a work-site label is needed unless a specific laboratory provision applies.

This is a practical simplification of Alberta s.400, not statutory wording. [AB-OHS-29 s.400]

## 5.3 Laboratory samples

HPR s.5 defines a laboratory sample as a sample:
- packaged in a container containing less than 10 kg;
- intended solely to be tested in a laboratory;
- excluding a sample used by the laboratory to test other products/mixtures/materials/substances;
- excluding samples used for educational/demonstration purposes. [HPR-5]

Therefore, “research sample,” “unknown,” “intermediate,” and “laboratory sample” are not interchangeable terms.

## 5.4 Products produced in a laboratory

Alberta s.403 provides specific treatment for certain products produced/used solely for laboratory analysis, testing or evaluation, provided they remain in the laboratory, are clearly identified and the applicable training requirements are met. [AB-OHS-29 s.403]

This should be taught as a **narrow workplace-labelling variation**, not as an exemption from hazard assessment, safe handling, exposure control or emergency planning.

## 5.5 Research and development samples

Health Canada guidance recognizes that some R&D samples may qualify for HPR laboratory-sample provisions if they meet the statutory criteria. The correct decision process is therefore:
1. determine whether the material is a hazardous product;
2. determine the transaction/possession context;
3. test the exact HPR laboratory-sample criteria;
4. then determine which supplier/workplace communication rules apply. [HC-WHMIS-GUIDE]

---

# 6. Chemical inventory as a risk-control system

## 6.1 Purpose

A chemical inventory should answer more than “Do we own this?”

It should support:
- emergency response;
- SDS retrieval;
- hazard assessment;
- storage compatibility;
- quantity control;
- purchasing/procurement;
- restricted-access management;
- expiry/stability review;
- inspection;
- waste/disposal;
- exposure assessment;
- regulatory review;
- incident investigation;
- business continuity.

CCOHS specifically describes an up-to-date laboratory product inventory as good practice. [CCOHS-LABS]

## 6.2 Recommended data model

The following fields are **good-practice synthesis**, not an Alberta-prescribed universal form.

### Identity
- product identifier exactly matching SDS;
- common/internal name;
- manufacturer/supplier;
- catalogue/product number;
- CAS number where appropriate;
- mixture/concentration;
- physical form.

### Ownership
- laboratory/group;
- accountable owner/custodian;
- backup contact;
- restricted-use authorization where applicable.

### Quantity
- original container size;
- current quantity or quantity band;
- aggregate quantity by room/storage zone where relevant;
- maximum approved quantity if internally controlled.

### Location
- building;
- room;
- storage unit/cabinet;
- shelf/bin position if needed;
- secondary-containment grouping.

### Hazard/storage
- principal hazard classes;
- local storage compatibility class;
- special segregation requirement;
- temperature/ventilation requirement where relevant;
- access restriction.

### Information
- SDS link;
- SDS supplier/revision date;
- date SDS was reviewed/verified;
- significant internal risk-assessment link;
- local SOP/code-of-practice link.

### Lifecycle
- date ordered;
- received;
- opened;
- retest/expiry/review date where applicable;
- peroxide-former or stability review flag where applicable;
- container condition;
- status: active / reserve / quarantined / waste / disposed / unknown;
- disposal date and waste-stream reference.

## 6.3 Ownership and data governance

Inventory failure is often governance failure.

Questions to define:
- Who creates the record?
- Who checks the incoming container against the record?
- Who changes location?
- Who closes a disposed record?
- Who reviews orphaned chemicals after staff departures?
- Who reconciles physical stock to the database?
- What fields are mandatory?
- Who can edit hazard/storage classifications?
- How are duplicate names avoided?
- How are unknowns handled?
- What happens when an SDS changes?

## 6.4 Inventory review

A defensible review program should include:
- periodic physical reconciliation;
- expired/stability-sensitive material review;
- ownerless material review;
- SDS currency sampling;
- storage-location verification;
- damaged-container identification;
- duplicate/unneeded stock reduction;
- disposal completion.

A mature system uses inventory data to reduce hazard at source by preventing unnecessary accumulation.

---

# 7. Safety Data Sheets: structure, critical reading, and limitations

## 7.1 Current 16-section structure

Under the HPR, the SDS follows the 16-section structure summarized by CCOHS: [CCOHS-SDS]

1. Identification  
2. Hazard identification  
3. Composition / information on ingredients  
4. First-aid measures  
5. Fire-fighting measures  
6. Accidental-release measures  
7. Handling and storage  
8. Exposure controls / personal protection  
9. Physical and chemical properties  
10. Stability and reactivity  
11. Toxicological information  
12. Ecological information  
13. Disposal considerations  
14. Transport information  
15. Regulatory information  
16. Other information

In Canada, Sections 12–15 are part of the standardized structure but specified information in those sections is not necessarily mandatory under the HPR in the same way as Sections 1–11 and 16. CCOHS marks these sections accordingly. [CCOHS-SDS]

## 7.2 A practical SDS reading sequence

For a laboratory task, a useful sequence is:

**Section 1 — Is this the right product?**  
Match the container product identifier and supplier/product code.

**Section 2 — What are the classified hazards?**  
Read classification, signal word, pictograms, hazard statements, precautionary statements and other hazards.

**Section 3 — What is actually in it?**  
Relevant for mixtures, sensitizers, toxic ingredients and concentration ranges.

**Sections 7 and 10 — What can go wrong during use/storage?**  
Handling, storage, incompatible materials, hazardous reactions, conditions to avoid, decomposition.

**Section 8 — What controls does the supplier identify?**  
OEL references, engineering-control guidance, PPE concepts. These must be interpreted for the actual task.

**Section 9 — What properties affect exposure/fire/containment?**  
Volatility, vapour pressure, flash point, physical state, pH, density, particle characteristics and other relevant properties.

**Section 11 — What health effects/routes matter?**  
Acute/chronic effects, routes, sensitization, carcinogenicity and other toxicological information.

**Sections 4–6 — What emergency information must be known before work starts?**  
First aid, fire, accidental release.

## 7.3 SDS limitations

CCOHS explicitly states that an SDS may not specify the safe-work procedures required by a particular workplace and may not answer specific PPE/respirator questions. [CCOHS-SDS]

An SDS usually does **not** know:
- your quantity;
- your scale;
- your exact concentration if altered;
- your ventilation performance;
- your room size;
- your transfer technique;
- your heating/pressure/vacuum;
- your neighbouring incompatible chemicals;
- your waste container;
- your worker population;
- your frequency/duration;
- your maintenance state;
- your process deviations;
- your emergency staffing.

Therefore:

> **SDS + task description + workplace conditions + control performance = useful risk assessment input.**

Possessing an SDS is not evidence that the task has been assessed.

---

# 8. Translating chemical hazard into task-specific risk

## 8.1 Step 1 — define the task precisely

Avoid “use acetone” or “handle acid.”

Better task definition:
- receive;
- transfer;
- dilute;
- heat;
- mix;
- sonicate;
- centrifuge;
- evaporate;
- clean;
- dispose;
- transport;
- spill response;
- equipment maintenance.

Risk changes between each phase.

## 8.2 Step 2 — identify credible hazards

Use:
- SDS;
- label;
- manufacturer technical information;
- scientific literature where needed;
- process history;
- institutional chemical-safety knowledge;
- regulatory information;
- equipment manuals.

Consider:
- toxicity;
- irritation/corrosion;
- sensitization;
- carcinogenicity;
- reproductive/developmental toxicity;
- flammability;
- oxidizing potential;
- self-reactivity;
- water reactivity;
- pyrophoricity;
- gas under pressure;
- cryogenic conditions;
- decomposition;
- incompatibility.

## 8.3 Step 3 — characterize exposure opportunity

### Route
- inhalation;
- skin;
- eye;
- ingestion;
- injection.

### Amount
Risk often rises with quantity, but not linearly. Small quantities of highly potent/sensitizing/reactive material can remain high consequence.

### Concentration
Dilution can reduce some hazards while creating new ones through exotherm, aerosolization or incompatibility.

### Physical state
- gas can disperse rapidly;
- volatile liquid can create inhalation/fire hazards;
- powder can generate dust;
- aerosol-generating operations can create inhalation/contamination risk;
- cryogenic liquid can create cold, pressure and oxygen-displacement hazards.

### Duration and frequency
Repeated routine exposure may dominate total dose even when each event is small.

### Worker proximity
Open handling close to the breathing zone or face creates a different exposure opportunity than closed automation.

## 8.4 Step 4 — identify process energy

Chemical incidents frequently involve **energy plus chemistry**.

Consider:
- heat;
- pressure;
- vacuum;
- agitation;
- centrifugation;
- sonication;
- grinding;
- electrostatic discharge;
- light/UV;
- ignition sources;
- compressed gas;
- sudden phase change.

## 8.5 Step 5 — examine incompatibilities

Compatibility assessment should use:
- SDS Sections 7 and 10;
- institutional compatibility charts;
- qualified chemical-safety review for unusual materials.

Avoid simplistic storage reasoning such as:
- “all acids together”;
- “all flammables together”;
- alphabetical storage across incompatibility classes.

## 8.6 Step 6 — assess existing controls

For each control ask:
- What hazard/exposure pathway is it intended to interrupt?
- Is it suitable?
- Has performance been verified?
- Can it fail silently?
- Is it dependent on worker behaviour?
- Is bypassing easy?
- Is there a backup layer?

## 8.7 Step 7 — consider abnormal conditions

Include:
- ventilation failure;
- power failure;
- wrong reagent;
- wrong concentration;
- blocked line;
- valve failure;
- dropped container;
- cracked vessel;
- overpressure;
- runaway heating;
- spill;
- splash;
- sensor failure;
- alarm ignored;
- loss of cooling;
- unexpected gas evolution;
- waste incompatibility;
- worker interruption;
- emergency evacuation during the task.

## 8.8 Step 8 — determine residual risk

Risk after controls should drive:
- whether work proceeds;
- whether a higher-level control is required;
- whether supervision is required;
- whether a permit/authorization is required;
- whether exposure monitoring is required;
- whether emergency provisions are adequate;
- whether a competent specialist must review the task.

---

# 9. Hierarchy of controls in laboratories

## 9.1 Elimination

Examples:
- remove an unnecessary chemical step;
- purchase a pre-prepared material rather than prepare it on-site;
- discontinue obsolete processes;
- dispose of unneeded stock.

Elimination removes the hazard rather than managing exposure.

## 9.2 Substitution

Examples:
- less volatile solvent;
- less corrosive cleaning agent;
- lower-concentration material;
- less hazardous analytical method.

Substitution requires reassessment because a substitute can introduce new hazards or reduce performance enough to create operational workarounds.

## 9.3 Engineering controls

Examples:
- enclosure;
- local exhaust ventilation;
- fume hood;
- closed transfer;
- interlock;
- pressure-relief design;
- physical guarding;
- remote operation;
- compatible secondary containment.

Engineering controls reduce dependence on perfect human behaviour.

## 9.4 Administrative controls

Examples:
- SOP;
- restricted access;
- authorized-user list;
- signage;
- training;
- competency checks;
- scheduling;
- buddy system;
- inspection;
- maintenance interval;
- permit system;
- quantity limits.

Administrative controls matter, but their reliability depends on implementation.

## 9.5 PPE

PPE is the last personal barrier and should not be treated as a substitute for higher-order controls when those are reasonably practicable.

PPE selection must account for:
- chemical;
- concentration;
- contact type;
- duration;
- permeation/breakthrough;
- splash versus immersion;
- dexterity;
- compatibility with other PPE;
- fit;
- maintenance/replacement;
- institutional program requirements.

This dossier intentionally does not prescribe universal gloves, respirators or cartridges.

---

# 10. Common laboratory hazard groups: conceptual control framework

This section describes **control concepts**, not handling procedures.

## 10.1 Flammables
Key failure modes:
- vapour ignition;
- static/ignition source;
- incompatible storage;
- excessive quantity;
- heating.

Control concepts:
- minimize quantity;
- eliminate ignition sources where feasible;
- use appropriate storage;
- ventilation/containment where needed;
- manage transfer and waste;
- segregate incompatible oxidizers/reactives. [CCOHS-FLAME]

## 10.2 Oxidizers
Failure modes:
- accelerated combustion;
- reaction with fuels/organics/reducing agents;
- contamination.

Controls:
- segregation;
- compatible containers;
- clean dedicated handling practices where required;
- quantity minimization;
- SDS/reactivity review. [CCOHS-OX]

## 10.3 Corrosives
Failure modes:
- skin/eye burn;
- corrosive vapour/mist;
- incompatible reaction;
- container degradation.

Controls:
- compatible storage;
- secondary containment;
- splash control;
- ventilation where relevant;
- emergency washing;
- segregation based on actual compatibility.

## 10.4 Acutely toxic chemicals
Failure modes:
- inhalation;
- dermal absorption;
- ingestion;
- accidental release.

Controls:
- minimize quantity;
- enclosure/local exhaust;
- restricted access;
- competent users;
- contamination control;
- emergency planning.

## 10.5 Sensitizers
Failure modes:
- repeated dermal/inhalation exposure leading to sensitization;
- later reaction at lower exposures.

Controls:
- prevent contact early;
- enclosure/LEV;
- contamination control;
- careful glove/PPE selection;
- reporting of symptoms through occupational-health channels.

## 10.6 Carcinogens / reproductive hazards
Controls:
- substitution where feasible;
- quantity minimization;
- designated procedures;
- enclosure;
- access control;
- exposure assessment;
- contamination prevention;
- documentation appropriate to institutional/regulatory requirements.

## 10.7 Compressed gases
Hazards may include:
- stored pressure;
- projectile/valve damage;
- toxicity;
- flammability;
- oxidizing properties;
- asphyxiation;
- incompatibility.

Controls:
- secure cylinders;
- compatible regulators/fittings;
- valve protection;
- ventilation;
- segregation;
- leak management;
- quantity/location control.

## 10.8 Cryogens
Distinct hazards:
- severe cold injury;
- pressure rise from vaporization;
- oxygen displacement;
- material embrittlement.

Controls:
- purpose-designed containers/equipment;
- ventilation and pressure management;
- appropriate PPE;
- transfer procedures;
- oxygen/asphyxiation risk assessment where relevant.

## 10.9 Peroxide-formers
Hazards:
- age/storage-dependent instability;
- concentration during evaporation;
- crystallization or shock-sensitive conditions.

Controls:
- procurement minimization;
- date tracking;
- opening/review dates;
- institutional testing/disposal rules;
- do not improvise testing or handling of suspect containers.

## 10.10 Pyrophoric and water-reactive materials
Controls should be designed and approved by competent institutional personnel, with:
- specialized containment;
- controlled atmosphere where required;
- appropriate emergency provisions;
- trained/authorized personnel;
- restricted quantities;
- specific SOPs.

This dossier deliberately avoids procedural handling instructions.

## 10.11 Hazardous waste
Waste can become more dangerous than the original task if:
- identity is lost;
- incompatible waste is combined;
- containers are inappropriate;
- pressure develops;
- waste accumulates;
- disposal status is unclear.

Alberta s.396 requires safe storage/handling using identification and worker instruction. [AB-OHS-29 s.396]

---

# 11. Compatibility-based storage, segregation, transport and housekeeping

## 11.1 Storage philosophy

Storage should be based on **compatibility**, not just alphabetical order or one hazard pictogram.

A substance may belong to more than one hazard class. One class may dominate storage decisions.

CCOHS notes that storage-cabinet and compatibility decisions must consider actual chemical incompatibilities rather than broad categories alone. [CCOHS-CABINETS]

## 11.2 Secondary containment

Secondary containment should be selected based on:
- compatibility;
- capacity;
- leak scenario;
- storage arrangement;
- ability to prevent cross-contact with incompatible materials.

It is not useful if a leak simply mixes incompatible materials within the same tray.

## 11.3 Access control

Restricted access can be appropriate for:
- highly hazardous substances;
- controlled materials;
- reactive chemicals;
- investigational materials;
- large quantities;
- areas requiring specific training.

Access control is an administrative layer, not a replacement for hazard control.

## 11.4 Inspections

Inspection programs should look for:
- label legibility;
- container integrity;
- corrosion;
- crystals/residue around caps;
- bulging containers;
- leaks;
- degraded tubing;
- unsecured cylinders;
- blocked vents/hoods;
- incompatible co-storage;
- expired/stability-sensitive materials;
- excessive quantity;
- orphaned materials;
- unclosed waste records.

## 11.5 Housekeeping

Chemical housekeeping is a risk-control activity:
- keep exits and emergency equipment accessible;
- remove unneeded materials;
- prevent accumulation of contaminated absorbents/waste;
- keep work surfaces suitable for decontamination;
- maintain separation between clean and contaminated zones.

## 11.6 Internal transport

Internal transport should consider:
- container closure;
- breakage;
- secondary containment;
- elevators/public corridors;
- incompatibilities;
- compressed-gas transport;
- emergency route;
- quantity.

Specific methods should be set by institutional procedure.

---

# 12. Ventilation and fume-hood use

CCOHS describes local exhaust ventilation as capture of contaminants at or near the source and notes that hood effectiveness depends on design, placement, cross-drafts, airflow and use. [CCOHS-VENT; CCOHS-HOODS]

A fume hood should therefore be treated as an **engineered containment system**, not simply a workbench with a fan.

Risk assessment should ask:
- Is the hood suitable for this hazard/process?
- Has performance been verified?
- Is the sash position within operating limits?
- Are large objects disrupting airflow?
- Are cross-drafts present?
- Is the worker’s breathing zone outside the containment zone?
- Is the process too energetic for an open-front hood?
- What happens if ventilation fails?

For high-hazard processes, competent ventilation or occupational-hygiene review may be required.

---

# 13. Change management and risk-assessment review

## 13.1 Legal triggers

Alberta s.7(4) explicitly requires repeat hazard assessment:
- at reasonably practicable intervals;
- on introduction of a new process;
- when a process/operation changes;
- before significant additions/alterations to the work site. [AB-OHS-2 s.7]

## 13.2 Good-practice additional triggers

A laboratory should also review when there is:
- new chemical;
- new concentration/formulation;
- scale-up;
- equipment replacement;
- changed ventilation;
- new room/location;
- changed waste stream;
- new incompatible neighbour material;
- changed staffing/supervision;
- incident or near miss;
- recurring deviation;
- new SDS/significant hazard information;
- change in supplier;
- evidence that an engineering control is degraded;
- regulatory/standard update.

These are synthesis recommendations, not claims that Alberta s.7 lists every item.

## 13.3 What change review should test

- Has the hazard changed?
- Has the exposure opportunity changed?
- Has consequence increased?
- Has control reliability changed?
- Are emergency arrangements still valid?
- Is training/competency still valid?
- Does inventory/storage need updating?
- Does the SOP need revision?
- Does the change affect another laboratory or shared facility?

---

# 14. Immediate actions after a spill, exposure, equipment failure, injury, near miss or uncontrolled reaction

## 14.1 Emergency response versus investigation

The first phase is **control and care**.

Priorities:
1. protect life;
2. warn others;
3. move to safety / evacuate where required;
4. activate the local emergency process;
5. obtain first aid, medical or emergency assistance;
6. isolate the area within training/authority;
7. prevent escalation;
8. communicate critical hazard information.

Only after the emergency is stabilized should the investigation process take over.

## 14.2 Why no universal spill threshold is appropriate

A universal “clean it yourself below X mL” rule is unsafe because response depends on:
- toxicity;
- volatility;
- flammability;
- reactivity;
- concentration;
- location;
- ventilation;
- drainage;
- quantity;
- responder competency;
- PPE;
- emergency resources.

The correct course instruction should direct learners to:
- the SDS;
- site spill/emergency procedure;
- trained institutional responders;
- emergency services when required.

---

# 15. Incident reporting, scene protection and statutory boundaries

## 15.1 Alberta reportable events

OHS Act s.33 requires reporting to a Director as soon as possible for specified categories, including:
- death;
- injury/illness/incident where there is reason to believe a worker has been or will be admitted to hospital beyond treatment in an emergency room or urgent-care facility;
- unplanned/uncontrolled explosion, fire or flood causing or having potential to cause serious injury/illness;
- listed crane/hoist and structural events;
- certain other prescribed events. [AB-OHS-ACT-33(1)–(4)]

The course should avoid giving workers the impression that they personally decide legal reportability. They should know how to escalate immediately to the responsible employer/safety function.

## 15.2 High-potential events

Section 33(5) requires investigation where:
- an incident had a likelihood of causing serious injury or illness; and
- there is reasonable cause to believe corrective action may need to be taken to prevent recurrence. [AB-OHS-ACT-33(5)]

This is highly relevant to laboratory near misses such as:
- runaway reaction controlled before rupture;
- incompatible chemical addition stopped just before mixing;
- dropped toxic chemical container that did not break;
- failed pressure vessel protection discovered before injury.

## 15.3 Investigation report

For events captured by s.33(6), the employer/prime contractor must:
- investigate circumstances;
- prepare a report describing circumstances and corrective action, if any;
- keep it readily available and provide it to an officer on demand;
- provide it to the Director and JHSC/representative as required by the section, or make it available to workers where no committee/representative exists;
- retain the report for at least two years. [AB-OHS-ACT-33(6)–(7)]

## 15.4 Scene preservation

For events required to be reported under s.33(1), the scene and related equipment/documents/information must not be disturbed except as necessary for:
- attending to ill/injured/deceased persons;
- preventing further injury/illness/incidents;
- protecting endangered property;
unless otherwise directed by a Director, OHS officer or police officer. [AB-OHS-ACT-33(9)]

## 15.5 Evidence preservation after safety

Good practice:
- identify exclusion boundary;
- take photographs before moving items where lawful/safe;
- preserve relevant containers;
- preserve labels;
- preserve instrument logs;
- prevent log overwriting;
- record equipment settings;
- capture environmental conditions;
- quarantine defective parts/material;
- preserve version-controlled procedures;
- preserve access/training/maintenance records;
- establish chain of custody if samples are retained.

---

# 16. Investigation evidence collection

## 16.1 Physical evidence

Examples:
- damaged equipment;
- fragments;
- containers;
- valves;
- tubing;
- PPE;
- spill patterns;
- residue;
- failed components;
- samples.

## 16.2 Documentary evidence

Examples:
- SOPs;
- risk assessments;
- SDSs;
- chemical inventory;
- maintenance logs;
- calibration records;
- inspection records;
- training records;
- competency assessments;
- procurement records;
- change-control records;
- incident history;
- waste logs.

## 16.3 Electronic/system evidence

Examples:
- instrument audit trails;
- alarm logs;
- building management system data;
- access control;
- ventilation alarms;
- temperature/pressure histories;
- electronic notebook records;
- version history;
- email/communication where relevant and appropriately authorized.

## 16.4 Witness evidence

Witness accounts should be obtained early enough to preserve memory but after immediate needs are addressed.

Interview principles:
- use open questions first;
- ask the witness to describe the sequence;
- separate observation from interpretation;
- ask what normally happens;
- ask what differed;
- ask about interruptions/workload;
- ask whether the written procedure matched real work;
- ask what made sense to the worker at the time;
- avoid blame-laden wording;
- allow corrections to summaries.

## 16.5 Trauma-informed and blame-aware interviewing

A trauma-informed approach does not mean avoiding facts. It means:
- explain purpose and process;
- avoid unnecessary accusation;
- allow reasonable support/breaks;
- avoid repeated unnecessary retelling;
- recognize that memory can be affected by stress;
- distinguish uncertainty from dishonesty.

A blame-aware approach recognizes that people can make unsafe choices while still asking what system conditions shaped those choices.

---

# 17. Investigation methods: uses and limitations

## 17.1 Timeline

**Purpose:** reconstruct event sequence.

Capture:
- normal state;
- initiating changes;
- actions;
- alarms;
- control response;
- escalation;
- emergency response;
- recovery.

**Strength:** exposes timing and dependencies.  
**Limitation:** chronology alone does not establish causation.

## 17.2 5 Whys

**Purpose:** push beyond immediate explanations.

Example:
- Why did the wrong waste container receive the material?
- Why was container identity unclear?
- Why was the label abbreviated?
- Why did the local system permit project shorthand?
- Why was the waste-labelling process not standardized?

**Strength:** quick and accessible.  
**Limitations:** linear, investigator-dependent, can force one chain, often too weak for complex/high-consequence events. CCOHS lists 5 Whys as one possible RCA tool rather than a universal method. [CCOHS-INVEST]

## 17.3 Fishbone / Ishikawa

Useful categories:
- task/procedure;
- people;
- equipment;
- material;
- environment;
- management/system.

**Strength:** broadens inquiry.  
**Limitation:** can become a brainstorming wall without evidence.

## 17.4 Barrier analysis

Ask:
- What barriers should have prevented the event?
- Did they exist?
- Were they suitable?
- Were they available?
- Were they bypassed?
- Did they fail?
- Was failure detectable?
- Was there a recovery barrier?

Barrier types:
- eliminate/substitute;
- engineering prevention;
- detection/alarm;
- administrative prevention;
- PPE;
- emergency mitigation.

## 17.5 Change analysis

Compare incident state to normal/safe state.

Potential changes:
- supplier;
- chemical lot;
- concentration;
- equipment;
- software;
- staff;
- procedure;
- workload;
- room;
- ventilation;
- maintenance;
- sequence;
- waste route.

Especially useful when a previously stable process suddenly fails.

## 17.6 Fault-tree analysis

Starts with top event and maps logical combinations of failures.

Useful for:
- process/engineering events;
- multiple barriers;
- high-consequence scenarios.

Limitations:
- resource intensive;
- quality depends on model scope;
- may underrepresent organizational/cultural conditions if framed only as component failures.

---

# 18. Avoiding “worker error” as the endpoint

CCOHS explicitly warns that stopping at “carelessness” can prevent identification of correctable conditions. Its investigation framework asks about task, material, environment, personnel and management factors. [CCOHS-INVEST]

A robust inquiry should test:

## Task design
- Was the sequence clear?
- Were steps feasible?
- Were simultaneous tasks required?
- Was there ambiguity?
- Did procedure differ from real work?

## Equipment
- Was correct equipment available?
- Was it maintained/calibrated?
- Were alarms functional?
- Were interlocks bypassable?
- Did design invite error?

## Materials
- Correct chemical?
- Correct concentration?
- Correct label?
- Correct container?
- Substitution by procurement?
- Compatibility understood?

## Environment
- lighting;
- noise;
- congestion;
- ventilation;
- temperature;
- workspace layout;
- interruptions.

## Workload
- fatigue;
- staffing;
- time pressure;
- competing priorities;
- after-hours/lone work.

## Training and competence
- attendance versus demonstrated competence;
- task-specific versus generic WHMIS;
- recency;
- supervision;
- experience with abnormal conditions.

## Supervision
- expectations;
- enforcement;
- escalation;
- tolerance of deviations;
- response to previous warnings.

## Procurement
- changed manufacturer/concentration/container?
- uncontrolled substitutions?
- excessive quantity?
- lack of pre-purchase hazard review?

## Maintenance
- overdue?
- deferred?
- repeated failure?
- known degraded condition?

## Management system
- were prior near misses closed?
- were corrective actions verified?
- did metrics reward speed or silence?
- did staff believe reporting would help?
- was responsibility clear?

---

# 19. Correction, containment, corrective action and preventive action

| Concept | Timing | Question | Example |
|---|---|---|---|
| Correction | Immediate | How do we fix the detected condition? | Replace a damaged label |
| Containment | Immediate/interim | How do we stop spread/exposure while investigating? | Quarantine affected stock |
| Corrective action | After cause analysis | How do we reduce recurrence of this detected problem? | Redesign the labelling workflow |
| Preventive action | Proactive/broader | Where else could this failure occur and how do we prevent it? | Apply new label-control design across other labs |

Health Canada’s current GUI-0158 follows this general distinction in a regulated NHP context. [HC-CAPA]

---

# 20. CAPA: applicability, record design and governance

## 20.1 Applicability boundary

Do not teach “CAPA is required by law in every laboratory.”

Use three categories:

**Occupational-safety incident management**  
Driven by OHS law and employer safety systems.

**Regulated quality-system CAPA**  
Driven by sector-specific GMP, medical-device, diagnostic, clinical, manufacturing or other requirements.

**General good-practice corrective-action system**  
A laboratory may voluntarily use CAPA-style methods even where no regulation uses the term.

## 20.2 Current Health Canada example

Health Canada **GUI-0158 Version 4**:
- publication: 4 September 2025;
- effective: 4 March 2026;
- replaces Version 3.0. [HC-GMP-V4]

Its CAPA process includes:
- identify issue;
- document/record;
- assemble appropriate SMEs;
- immediate corrections;
- root-cause analysis;
- impact evaluation;
- corrective/preventive action;
- implementation;
- effectiveness monitoring;
- closure. [HC-CAPA]

## 20.3 Credible CAPA record

### Problem statement
Describe:
- what happened;
- where;
- when;
- what requirement/control failed;
- what is known versus assumed.

Avoid vague language such as “operator error occurred.”

### Scope
Determine:
- affected equipment;
- materials;
- batches/samples;
- rooms;
- teams;
- time period;
- related incidents.

### Risk rating
Assess:
- severity;
- likelihood;
- detectability where relevant;
- regulatory impact;
- product/patient/worker impact;
- recurrence;
- uncertainty.

### Immediate action
Record:
- correction;
- containment;
- interim controls;
- decision authority.

### Evidence
List:
- documents;
- interviews;
- physical evidence;
- data;
- tests;
- timeline.

### Cause analysis
Differentiate:
- direct cause;
- contributing factors;
- system/root causes;
- unproven hypotheses.

### Action design
Each action should state:
- cause addressed;
- owner;
- deliverable;
- resource;
- due date;
- dependency;
- change control required;
- verification evidence.

### Interim controls
Needed when permanent action takes time.

Examples:
- temporary suspension;
- restricted access;
- increased inspection;
- second-person verification;
- temporary lower quantity.

### Verification
Confirm the action exists:
- installed;
- document approved;
- training completed;
- system field changed.

### Effectiveness
Confirm it works:
- measured control performance;
- no recurrence over sufficient opportunities;
- observed compliance;
- risk reduced;
- no unacceptable side effect.

### Closure
Closure should require:
- actions complete;
- verification complete;
- effectiveness criteria met or justified;
- records linked;
- residual risk accepted by appropriate authority.

## 20.4 Why “retraining” is often weak CAPA

Retraining is appropriate if:
- required knowledge was not provided;
- competency was not demonstrated;
- training content was wrong;
- training expired and skill degraded.

Retraining is weak if:
- equipment design caused the failure;
- label system was ambiguous;
- workload made compliance unrealistic;
- engineering control was absent;
- procedure contradicted actual workflow;
- management tolerated the deviation.

CAPA should follow the hierarchy of controls.

---

# 21. Effectiveness checks

## 21.1 Define before closure

A strong effectiveness plan specifies:
- what outcome should change;
- how it will be measured;
- sample size / number of opportunities;
- time interval;
- acceptable threshold;
- reviewer;
- what happens if ineffective.

## 21.2 Examples

**Engineering change**  
Measure ventilation/containment performance against defined criteria.

**Inventory change**  
Sample physical inventory against database after two review cycles.

**Waste-labelling change**  
Audit a defined number of waste containers for correct identification over several weeks.

**Training change**  
Assess task demonstration or scenario competence, not only quiz completion.

**Maintenance change**  
Track overdue preventive-maintenance rate and repeat failure rate.

## 21.3 Effectiveness failure

If an action is ineffective:
- reopen/escalate;
- reconsider causal analysis;
- reassess risk;
- strengthen interim controls;
- consider higher-order controls.

---

# 22. Performance indicators and reporting culture

## 22.1 Leading indicators

Useful laboratory leading indicators:
- high-risk assessments reviewed on time;
- overdue corrective actions by risk;
- percent of engineering controls with current verification;
- critical maintenance overdue;
- inventory-SDS match rate;
- orphaned-chemical count;
- inspection findings closed on time;
- near-miss investigation timeliness;
- effectiveness checks completed;
- competency demonstrations passed;
- management response time to hazard reports.

CCOHS recommends impact-oriented leading indicators rather than counting activity alone. [CCOHS-INDICATORS]

## 22.2 Lagging indicators

Examples:
- injuries;
- occupational illnesses;
- overexposures;
- spills;
- fires;
- uncontrolled reactions;
- lost time;
- equipment damage;
- reportable incidents;
- repeat nonconformities;
- regulatory findings.

## 22.3 Why low numbers can mislead

CCOHS notes that:
- lagging indicators are retrospective;
- small workplaces may have too few events for stable trends;
- not all injuries/incidents are reported. [CCOHS-INDICATORS]

A 2023 systematic review found underreporting across included studies and identified fear, cumbersome reporting, lack of knowledge, normalization of injury, poor psychosocial environment and distrust as recurring reasons. [KYUNG-2023]

Probst et al. found substantially greater underreporting in organizations with poorer safety climate in a construction sample. [PROBST-2008]

Lipscomb et al. found injury reporting was less prevalent where workers experienced discipline related to injury and documented substantial fear of reprisal. [LIPSCOMB-2013]

These populations are not laboratory populations, so they should not be treated as laboratory-specific prevalence estimates. They are evidence that organizational incentives and safety climate can distort reporting behaviour.

## 22.4 Metric design principles

Avoid:
- bonuses tied simply to “zero incidents”;
- treating more near-miss reports as worse safety;
- closing CAPAs to hit a target without effectiveness evidence;
- measuring training by attendance only.

Prefer:
- quality of reporting;
- responsiveness;
- control improvement;
- recurrence reduction;
- hazard elimination;
- worker participation.

---

# 23. Applied case 1 — chemical near miss: incompatible waste interface

## Scenario

A research laboratory uses several solvent and aqueous waste streams. A worker carries a small secondary container to a shared waste area. Both the secondary container and receiving bottle use project abbreviations rather than full product/waste descriptions. When the receiving cap is loosened, the worker notices unexpected heat and stops. No material is added beyond a very small initial amount. Nobody is injured.

## Immediate phase

The worker should:
- stop;
- warn others;
- follow the site emergency/waste procedure;
- avoid improvising further handling;
- escalate to trained waste/safety personnel.

No universal neutralization or disposal instruction should be taught.

## Why this is a near miss

The absence of injury is partly due to early detection. Credible outcomes could include:
- uncontrolled reaction;
- pressure;
- splash;
- toxic vapour;
- fire.

Depending on the facts, the Alberta s.33(5) high-potential incident investigation test may require consideration. [AB-OHS-ACT-33]

## Evidence to collect

- container labels;
- waste SOP;
- waste compatibility rules;
- photographs;
- identity of materials;
- SDS Sections 7/10;
- inventory/waste records;
- training records;
- prior waste incidents;
- physical layout;
- why project abbreviations became normal.

## Weak conclusion

> Worker selected wrong bottle.

This does not explain why the system made wrong selection credible.

## Better causal questions

- Were waste streams uniquely identified?
- Was full chemical information available at point of disposal?
- Were incompatible streams physically separated?
- Did the procedure match real workflow?
- Had shorthand labels been tolerated?
- Was waste training task-specific?
- Were there too many similar containers?
- Did procurement/research changes create new waste not reflected in the system?

## Potential actions

Higher-order:
- redesign/standardize waste identification;
- physically segregate incompatible waste streams;
- eliminate unnecessary waste categories;
- change container/interface design.

Administrative:
- revise procedure;
- verify competence;
- inspect waste stations.

## Effectiveness check

Sample waste containers and disposal events over a defined period:
- correct identity;
- correct segregation;
- no ambiguous abbreviations;
- worker can explain disposal decision process.

---

# 24. Applied case 2 — serious chemical incident: uncontrolled exotherm with hospitalization

## Scenario

A routine process is performed at a larger scale than usual. Temperature rises rapidly. Material is ejected from the vessel. A worker sustains chemical/thermal injuries and is admitted to hospital beyond emergency-room treatment.

## Immediate phase

- emergency response;
- medical care;
- area isolation;
- prevent additional exposure;
- emergency communication;
- preserve scene once safe.

## Alberta reporting boundary

Hospital admission beyond ER/urgent-care treatment is one of the s.33(2) reporting triggers. An unplanned/uncontrolled explosion or fire with serious-injury potential can independently trigger reporting. [AB-OHS-ACT-33]

## Scene

Because the event is reportable, do not disturb the scene except as permitted by s.33(9), unless directed by authorized officials. [AB-OHS-ACT-33(9)]

## Investigation questions

### Process
- Was scale increased?
- Was scale-up formally reviewed?
- Were heat-removal assumptions valid?
- Was addition/mixing sequence controlled?

### Equipment
- temperature sensing;
- alarm;
- cooling;
- relief;
- vessel suitability;
- maintenance;
- calibration.

### Material
- identity;
- concentration;
- lot;
- contamination;
- substitution.

### Procedure
- version;
- instructions for scale;
- abnormal-condition response;
- deviation history.

### Human/system
- authorization;
- supervision;
- workload;
- training;
- prior warning signs;
- management of change.

## Weak CAPA

> Retrain operator to add material more slowly.

This presumes the operator is the dominant cause and leaves the process capable of dangerous escalation.

## Stronger CAPA direction

Potentially:
- prevent the hazardous scale/sequence by design;
- add engineered limits/interlocks;
- revise scale-up authorization;
- verify thermal/process safety assumptions;
- revise abnormal-condition controls;
- then update training.

Specific process-safety engineering would require qualified technical review.

---

# 25. Applied case 3 — recurring nonconformity: inventory and SDS lifecycle failure

## Scenario

Internal inspections over six months repeatedly find:
- containers with unknown opening dates;
- disposed chemicals still listed as active;
- SDS links pointing to older revisions;
- materials stored under former employees’ names;
- missing storage-class data.

No injury has occurred.

## Why this matters

The pattern weakens:
- emergency response;
- compatibility review;
- expiry/stability control;
- SDS access;
- accountability;
- disposal;
- change management.

## Immediate correction

- update individual records;
- identify/dispose of unknown/orphaned materials under institutional process;
- replace bad SDS links.

## Root-cause possibilities

- inventory is optional/duplicate;
- no defined owner;
- procurement not integrated;
- disposal does not close record;
- staff departure workflow omits chemicals;
- database lacks required fields;
- no reconciliation schedule.

## Corrective action

Redesign chemical lifecycle:
**purchase → receive → assign owner → store → use → review → transfer → waste → disposal → record closure**

## Effectiveness

After two inventory cycles:
- physical/database match rate;
- orphaned-material count;
- disposed-but-active count;
- SDS currency sampling;
- overdue review rate.

---

# 26. Matters requiring local expert or emergency judgment

Do not give universal answers for:

- respirator necessity/type/cartridge;
- glove material or breakthrough time;
- spill-cleanup threshold;
- neutralization;
- disposal route;
- occupational exposure sampling strategy;
- medical evaluation;
- pregnancy/reproductive-risk accommodation;
- pyrophoric handling;
- peroxide-former testing;
- cryogenic engineering;
- reactive-chemistry scale-up;
- fume-hood suitability for unusual/high-energy tasks;
- fire-code quantity limits;
- whether a specific event meets a statutory reporting threshold;
- whether specific exposure data demonstrate compliance.

These may require:
- EHS;
- industrial hygienist;
- occupational physician/nurse;
- chemical safety specialist;
- process-safety specialist;
- facilities/engineering;
- fire/emergency response;
- hazardous-waste personnel;
- regulator.

---

# 27. Evidence gaps, conflicts and changing requirements

## 27.1 Alberta Code currency

Alberta’s main OHS page identifies a free Code version **in force 31 March 2025** and an OHS Act/Regulation/Code handbook dated 11 June 2025. [AB-CODE-STATUS]

The searchable legislation tool is useful for individual sections, but legal users should rely on the official Alberta version and current amendments.

## 27.2 Active Alberta OEL review in 2026

Alberta’s OHS Code review page states that occupational exposure limits and the approach to referenced technical standards were still under review in 2025–2026. A 2026 consultation document proposes updates to Section 20 technical references. Therefore, Part 4/Schedule 1 should be rechecked immediately before course publication. [AB-CODE-REVIEW]

## 27.3 Federal WHMIS currency

The HPR consolidation reviewed was current into July 2026 and last amended December 2022. Re-check the Justice Laws consolidation before final course release. [HPR]

## 27.4 GHS currency

GHS Rev. 11 (2025) is current internationally, with Rev. 12 expected in 2027. Canada does not automatically adopt each revision. [UNECE-GHS11]

## 27.5 ISO 45001 status

ISO states:
- ISO 45001:2018 remains published;
- it was confirmed in 2024;
- Amendment 1:2024 applies;
- a second edition is under development as ISO/DIS 45001 in 2026. [ISO-45001; ISO-A1; ISO-DIS]

Only official public ISO summaries were used. No inaccessible clause text is presented as reviewed.

## 27.6 WHO handbook age

WHO’s *Laboratory Quality Management System: Handbook* was published in 2011. It remains a useful quality-management reference, especially for occurrence management, but should not be treated as current Canadian law or as the controlling quality requirement for a regulated Canadian operation. [WHO-LQMS]

## 27.7 CAPA terminology differences

Health Canada’s NHP guidance explicitly distinguishes corrective and preventive actions. Other systems may embed prevention in risk management. The eventual course should teach concepts first and tell learners to use their organization’s required terminology.

---

# 28. Claim-to-source matrix

| Claim | Type | Source |
|---|---|---|
| WHMIS is Canada’s hazard communication system using classification, labels, SDSs and worker education | Government guidance | HC-WHMIS-RR |
| Federal supplier requirements are administered under HPA/HPR | Law / government | HPA-13; HPA-14; HPR |
| Employers in Alberta must identify existing/potential hazards and document controls | Law | AB-OHS-2 s.7 |
| Hazard assessments must be repeated at stated change triggers | Law | AB-OHS-2 s.7(4) |
| Affected workers must participate in hazard assessment/control | Law | AB-OHS-2 s.8 |
| Alberta hierarchy prioritizes elimination/engineering before administrative controls/PPE | Law | AB-OHS-2 s.9 |
| Employers must adequately train workers in matters necessary for safe work | Law | AB-OHS-3 |
| JHSC/representative requirements depend on workforce thresholds | Law | AB-OHS-JHSC |
| Alberta Part 29 requires WHMIS training for workers working with/near hazardous products | Law | AB-OHS-29 s.397 |
| Decanted container immediate-use exemption has specific conditions | Law | AB-OHS-29 s.400 |
| Alberta lab-sample provisions do not create a general laboratory exemption | Law | AB-OHS-29 s.403 |
| Employer generally must obtain supplier SDS | Law | AB-OHS-29 s.404 |
| Required SDS must be readily available to potentially exposed workers | Law | AB-OHS-29 s.407 |
| Federal laboratory sample is <10 kg and solely for testing, with exclusions | Law | HPR-5 |
| Small supplier container ≤100 mL may omit hazard/precautionary statements | Government guidance interpreting HPR | CCOHS-LABS |
| SDS has standardized 16-section structure | Regulation/guidance | CCOHS-SDS |
| SDS may not specify task-specific safe-work procedures | Government guidance | CCOHS-SDS |
| Listed harmful-substance exposure must be ALARA and within OEL | Law | AB-OHS-4 s.16 |
| Combined similar-toxic-action exposures require specific consideration | Law | AB-OHS-4 s.17 |
| Long shifts require exposure-limit adjustment subject to provisions | Law | AB-OHS-4 s.18 |
| Compliance air measurement must use specified methods and competent person | Law | AB-OHS-4 s.20 |
| Employer must assess potential harmful-substance exposure and establish minimizing procedures | Law | AB-OHS-4 s.21 |
| Overexposure requires immediate causal/control action and worker explanation | Law | AB-OHS-4 s.22 |
| Immediate access to suitable eyewash/shower or other equipment is required for harmful eye/skin chemical use | Law | AB-OHS-4 s.24 |
| Certain listed substances above thresholds require a code of practice | Law | AB-OHS-4 s.26; AB-OHS-SCH1 |
| Harmful substances must be identified and safely stored | Law | AB-OHS-4 s.27 |
| Emergency response plan required where rescue/evacuation may be needed | Law | AB-OHS-7 |
| Specified serious events must be reported as soon as possible | Law | AB-OHS-ACT-33 |
| High-potential incidents may independently require investigation | Law | AB-OHS-ACT-33(5) |
| Reportable-event scene preservation has specific exceptions | Law | AB-OHS-ACT-33(9) |
| Incident investigations should not stop at carelessness | Government guidance | CCOHS-INVEST |
| 5 Whys and fault-tree analysis are recognized RCA tools, not proof of causation | Government guidance | CCOHS-INVEST |
| CAPA is illustrated by current Health Canada NHP GMP guidance | Sector-specific government guidance | HC-CAPA; HC-GMP-V4 |
| GUI-0158 V4 became effective 4 Mar 2026 | Government guidance status | HC-GMP-V4 |
| CAPA effectiveness should be revisited after implementation | Government guidance | HC-CAPA |
| Leading and lagging indicators should be balanced | Government guidance | CCOHS-INDICATORS |
| Underreporting can be driven by fear, reporting burden, poor climate and distrust | Peer-reviewed systematic review | KYUNG-2023 |
| Poor safety climate has been associated with greater underreporting | Peer-reviewed observational study | PROBST-2008 |
| Disciplinary consequences can suppress injury reporting | Peer-reviewed observational study | LIPSCOMB-2013 |
| GHS Rev. 11 is current UN edition in 2026 | International authoritative source | UNECE-GHS11 |
| ISO 45001:2018 remains current while revision is under development | Standards-body status | ISO-45001; ISO-DIS |

---

# 29. Annotated bibliography and source register

## A. Canadian federal legislation

### HPA-13 — Hazardous Products Act, s.13
Government of Canada, Justice Laws.  
https://laws-lois.justice.gc.ca/eng/acts/H-3/section-13.html  
Accessed 17 Sept 2026.  
Federal prohibition on sale without required SDS/label conditions.

### HPA-14 — Hazardous Products Act, s.14
https://laws-lois.justice.gc.ca/eng/acts/H-3/section-14.html  
Accessed 17 Sept 2026.  
Parallel importation requirements.

### HPR — Hazardous Products Regulations, SOR/2015-17
https://laws-lois.justice.gc.ca/eng/regulations/SOR-2015-17/  
Accessed 17 Sept 2026.  
Detailed supplier classification, label, SDS and exception requirements. Search result stated current to 21 July 2026 and last amended 15 Dec 2022.

### HPR-5 — Hazardous Products Regulations, s.5
https://laws-lois.justice.gc.ca/eng/regulations/SOR-2015-17/section-5.html  
Accessed 17 Sept 2026.  
Laboratory-sample definition and supplier exceptions.

### HPR-5.12 — Hazardous Products Regulations, s.5.12
https://laws-lois.justice.gc.ca/eng/regulations/SOR-2015-17/section-5.12.html  
Accessed 17 Sept 2026.  
Significant-new-data definition and 90/180-day transition provisions.

## B. Health Canada and CCOHS

### HC-WHMIS-RR — Health Canada, Roles and responsibilities under WHMIS
https://www.canada.ca/en/health-canada/services/environmental-workplace-health/occupational-health-safety/workplace-hazardous-materials-information-system/roles-responsibilities-whmis.html  
Accessed 17 Sept 2026.  
Concise authoritative description of supplier, employer and worker roles.

### HC-WHMIS-GUIDE — Health Canada, Guidance on the WHMIS supplier requirements
https://www.canada.ca/en/health-canada/services/environmental-workplace-health/occupational-health-safety/workplace-hazardous-materials-information-system/supplier-hazard-communication-requirements-whmis/guidance.html  
Accessed 17 Sept 2026.  
Detailed federal supplier interpretation, significant-new-data updates, laboratory samples and R&D context.

### CCOHS-LABS — WHMIS: Laboratories
https://www.ccohs.ca/oshanswers/chemicals/whmis_ghs/laboratories.html  
Accessed 17 Sept 2026.  
Revised May 2026. Laboratory-specific WHMIS guidance, small containers, decanting and inventory good practice.

### CCOHS-SDS — WHMIS: Safety Data Sheet (SDS)
https://www.ccohs.ca/oshanswers/chemicals/whmis_ghs/sds.html  
Accessed 17 Sept 2026.  
Revised 28 May 2026. SDS structure, intended use and limitations.

### CCOHS-INVEST — Incident Investigation
https://www.ccohs.ca/oshanswers/hsprograms/investig.html  
Accessed 17 Sept 2026.  
Systems-oriented investigation guidance and RCA tools.

### CCOHS-INDICATORS — Health and Safety Programs: Leading and Lagging Indicators
https://www.ccohs.ca/oshanswers/hsprograms/leading-and-lagging-indicators.html  
Accessed 17 Sept 2026.  
Balanced performance-measurement guidance.

### CCOHS-FLAME — Working safely with Flame pictogram products
https://www.ccohs.ca/oshanswers/chemicals/howto/flame.html  
Accessed 17 Sept 2026.

### CCOHS-OX — Working safely with Flame-over-Circle products
https://www.ccohs.ca/oshanswers/chemicals/howto/flameovercircle.html  
Accessed 17 Sept 2026.

### CCOHS-CABINETS — Storage Safety Cabinets for Hazardous Chemicals
https://www.ccohs.ca/oshanswers/prevention/safety_cabinets.html  
Accessed 17 Sept 2026.

### CCOHS-VENT — Industrial Ventilation: Introduction
https://www.ccohs.ca/oshanswers/prevention/ventilation/introduction.html  
Accessed 17 Sept 2026.

### CCOHS-HOODS — Industrial Ventilation: Hoods
https://www.ccohs.ca/oshanswers/prevention/ventilation/hoods.html  
Accessed 17 Sept 2026.

## C. Alberta law and official resources

### AB-CODE-STATUS — Government of Alberta, Occupational Health and Safety Code
https://www.alberta.ca/occupational-health-and-safety-code  
Accessed 17 Sept 2026.  
Identifies Code version in force 31 Mar 2025 and current publication status.

### AB-OHS-3 — Alberta OHS Act, General obligations
https://search-ohs-laws.alberta.ca/legislation/occupational-health-and-safety-act/part-1-general-obligations/  
Accessed 17 Sept 2026.  
Employer, supervisor and worker duties; employer training requirement.

### AB-OHS-JHSC — Alberta OHS Act, Part 2: Committees, representatives and programs
https://search-ohs-laws.alberta.ca/legislation/occupational-health-and-safety-act/part-2-health-and-safety-committees-representatives-and-programs/  
Accessed 17 Sept 2026.

### AB-OHS-2 — Alberta OHS Code, Part 2
https://search-ohs-laws.alberta.ca/legislation/occupational-health-and-safety-code/part-2-hazard-assessment-elimination-and-control/  
Accessed 17 Sept 2026.  
Hazard assessment, worker participation, hierarchy and emergency control.

### AB-OHS-4 — Alberta OHS Code, Part 4
https://search-ohs-laws.alberta.ca/legislation/occupational-health-and-safety-code/part-4-chemical-hazards-biological-hazards-and-harmful-substances/  
Accessed 17 Sept 2026.  
Exposure limits, assessment, monitoring, overexposure, decontamination, emergency washing, codes of practice and storage.

### AB-OHS-SCH1 — Alberta OHS Code, Schedule 1 Chemical Substances
https://search-ohs-laws.alberta.ca/legislation/occupational-health-and-safety-code/schedule-1-chemical-substances/  
Accessed 17 Sept 2026.

### AB-OHS-7 — Alberta OHS Code, Part 7
https://search-ohs-laws.alberta.ca/legislation/occupational-health-and-safety-code/part-7-emergency-preparedness-and-response/  
Accessed 17 Sept 2026.

### AB-OHS-29 — Alberta OHS Code, Part 29 WHMIS
https://search-ohs-laws.alberta.ca/legislation/occupational-health-and-safety-code/part-29-workplace-hazardous-materials-information-system-whmis/  
Accessed 17 Sept 2026.

### AB-OHS-ACT-33 — Alberta OHS Act, s.33
https://search-ohs-laws.alberta.ca/legislation/occupational-health-and-safety-act/part-7-compliance-and-enforcement/  
Accessed 17 Sept 2026.  
Serious-event reporting, high-potential investigation, investigation reports and scene preservation.

### AB-HAZARD-GUIDE — Hazard assessment and control: handbook for Alberta employers and workers
https://ohs-pubstore.labour.alberta.ca/bp018  
Updated Oct 2023; accessed 17 Sept 2026.  
Government best-practice guide explaining Alberta hazard-assessment framework.

### AB-CODE-REVIEW — Alberta OHS Code review
https://www.alberta.ca/ohs-code-review  
Accessed 17 Sept 2026.  
Documents current 2025–2026 review topics, including OELs and technical-standard references.

## D. Regulated quality / CAPA

### HC-GMP-V4 — Health Canada, Good manufacturing practices guide for natural health products (GUI-0158)
https://www.canada.ca/en/health-canada/services/drugs-health-products/compliance-enforcement/good-manufacturing-practices/guidance-documents/guide-natural-health-products-0158.html  
Published 4 Sept 2025; effective 4 Mar 2026; accessed 17 Sept 2026.  
Current version/status source.

### HC-CAPA — GUI-0158: Risk classification, CAPA process
https://www.canada.ca/en/health-canada/services/drugs-health-products/compliance-enforcement/good-manufacturing-practices/guidance-documents/guide-natural-health-products-0158/risk-classification-capa-process.html  
Accessed 17 Sept 2026.  
Detailed regulated example of correction, containment, RCA, CAPA, effectiveness and closure.

## E. International standards and guidance

### UNECE-GHS11 — GHS Rev. 11
https://unece.org/transport/documents/2025/09/standards/globally-harmonized-system-classification-and-labelling  
Published 2025; accessed 17 Sept 2026.  
Most recent GHS edition identified by UNECE.

### ISO-45001 — ISO 45001:2018
https://www.iso.org/standard/45001  
Accessed 17 Sept 2026.  
Official status page: 2018 edition confirmed in 2024; revision under development.

### ISO-A1 — ISO 45001:2018/Amd 1:2024
https://www.iso.org/standard/88428.html  
Published Feb 2024; accessed 17 Sept 2026.

### ISO-DIS — ISO/DIS 45001
https://www.iso.org/standard/45001/rev  
Accessed 17 Sept 2026.  
Second edition under development in 2026.

### WHO-LQMS — WHO Laboratory Quality Management System: Handbook
https://www.who.int/publications-detail-redirect/9789241548274  
Published 1 Jan 2011; accessed 17 Sept 2026.  
Quality-system reference for clinical/public-health laboratories.

## F. Peer-reviewed evidence

### KYUNG-2023
Kyung M, Lee S-J, Dancu C, Hong O. “Underreporting of workers’ injuries or illnesses and contributing factors: a systematic review.” *BMC Public Health*. 2023;23:558.  
https://pubmed.ncbi.nlm.nih.gov/36959647/  
Systematic review of worker underreporting. Important limitation: US studies and heterogeneous populations.

### PROBST-2008
Probst TM, Brubaker TL, Barsotti A. “Organizational injury rate underreporting: the moderating effect of organizational safety climate.” *Journal of Applied Psychology*. 2008;93(5):1147–1154.  
https://pubmed.ncbi.nlm.nih.gov/18808232/  
Observational construction-sector evidence linking safety climate to reporting accuracy. Not laboratory-specific.

### LIPSCOMB-2013
Lipscomb HJ, Nolan J, Patterson D, Sticca V, Myers DJ. “Safety, incentives, and the reporting of work-related injuries among union carpenters.” *American Journal of Industrial Medicine*. 2013;56(4):389–399.  
https://pubmed.ncbi.nlm.nih.gov/23109103/  
Evidence that disciplinary and incentive structures can affect reporting. Not laboratory-specific.

### NIGMS-LAB-SAFETY-2020
“Developing a culture of safety in biomedical research training.”  
https://pubmed.ncbi.nlm.nih.gov/33054637/  
Discusses research-laboratory safety culture and hazard assessment.

---

# 30. Research conclusions for later instructional design

The eventual course should be built around a **decision chain**, not chemical memorization:

**Identify → Understand → Assess → Control → Verify → Respond → Investigate → Correct → Check effectiveness → Learn**

The core conceptual distinctions that learners should leave with are:

1. **Hazard is not risk.**
2. **A label/SDS communicates hazard; it does not complete the workplace risk assessment.**
3. **Small-container/laboratory provisions are variations, not blanket exemptions.**
4. **Inventory is part of risk control, not clerical housekeeping.**
5. **Engineering controls are generally more reliable than behaviour-dependent controls.**
6. **PPE is important but is not the first control choice when higher-order controls are reasonably practicable.**
7. **Emergency response and incident investigation are different phases.**
8. **No-injury near misses can still require serious investigation.**
9. **“Worker error” is an event description, not a sufficient root cause.**
10. **Correction is not corrective action.**
11. **Action completion is not proof of effectiveness.**
12. **CAPA terminology has sector-specific regulatory meaning.**
13. **Low incident numbers do not automatically mean low risk.**
14. **A reporting culture is only useful if reports lead to visible, competent action.**
15. **Risk assessments must change when work changes.**

That decision structure is strong enough to support a later high-school-reading-level course without sacrificing the legal and technical foundations established in this dossier.
