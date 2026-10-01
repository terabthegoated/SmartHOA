# SmartHOA Decision Support System Rules

## Purpose

SmartHOA uses explainable, rule-based decision support rather than opaque automated decisions. The system does not make decisions for HOA officers. It identifies measurable community conditions, presents the supporting evidence, and recommends an action for the officer to review.

## Indicators and recommendation rules

| Indicator | Data source | Trigger | Recommendation |
| --- | --- | --- | --- |
| Monthly collection rate | Payments for the current billing month | Less than 80% of amount billed is marked paid | Send payment reminders and follow up with overdue households. |
| Overdue accounts | Payments for the current billing month | One or more households are overdue | Review affected accounts and send targeted reminders. |
| High-priority complaints | Open complaints with High or Critical priority | One or more are open | Assign an officer and set an immediate resolution plan. |
| Aging complaint queue | Open complaints | A complaint has been open for more than seven days | Review delayed cases and publish an update for residents. |
| Resolution time | Resolved and closed complaints | Average exceeds seven days | Review workload and prioritize delayed categories. |
| Resident satisfaction | Feedback ratings for resolved complaints | Average rating is below 3.5 out of 5 | Review resident feedback and improve the resolution process. |
| Recurring issue | Complaints by category in the most recent 30 days | Three or more complaints in one category | Schedule a targeted inspection or preventive action. |

## Complaint priority recommendation rules

New complaints receive an explainable recommendation from the resident-selected category and the words in the submitted title and description. Rules are evaluated in order; the first matching higher-risk rule wins.

| Recommended priority | Predefined criteria | Rule code |
| --- | --- | --- |
| Critical | Possible immediate danger, including fire, smoke, gas leak, explosion, electrocution, live or exposed wires, collapse, sinkhole, armed intruder, weapon, or an assault in progress. | `CRITICAL_IMMEDIATE_SAFETY` |
| High | A reported security, safety, or essential-service concern such as trespass, theft, threats, power outage, no water, burst pipe, sewage, open manhole, or unsafe structure. All reports submitted under the Security category are High when no Critical rule applies. | `HIGH_RISK_OR_SERVICE_DISRUPTION` or `HIGH_SECURITY_CATEGORY` |
| Medium | A standard Maintenance, Utilities, Parking, Noise, or Cleanliness concern with no Critical or High indicator. | `MEDIUM_OPERATIONAL_CATEGORY` |
| Low | A routine or general report, including Others, that does not match a higher-risk criterion. | `LOW_ROUTINE_REVIEW` |

The system stores the recommendation, matched-rule code, and plain-language reason with the complaint. `priority_level` is the effective queue priority. An HOA officer may override it, but the system requires the officer to record a reason; the original recommendation remains available for audit and review.

## Transparency safeguards

- Every recommendation displays its evidence and an officer action link.
- Officers retain final judgment and can inspect the underlying payments or complaints.
- Resident feedback is reported only as an aggregated community score.
- The system is designed to assist operational planning; it does not automatically penalize residents or close complaints.
