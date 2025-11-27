import { pgEnum } from "drizzle-orm/pg-core";

export const projectStatusEnum = pgEnum("project_status", [
  "no_latest_action",
  "bookkeeping_work_required", 
  "in_review",
  "needs_client_input",
  "completed"
]);

export const nationalityEnum = pgEnum("nationality", [
  "afghan", "albanian", "algerian", "american", "andorran", "angolan", "antiguans", "argentinean", "armenian", "australian",
  "austrian", "azerbaijani", "bahamian", "bahraini", "bangladeshi", "barbadian", "barbudans", "batswana", "belarusian", "belgian",
  "belizean", "beninese", "bhutanese", "bolivian", "bosnian", "brazilian", "british", "bruneian", "bulgarian", "burkinabe",
  "burmese", "burundian", "cambodian", "cameroonian", "canadian", "cape_verdean", "central_african", "chadian", "chilean", "chinese",
  "colombian", "comoran", "congolese", "costa_rican", "croatian", "cuban", "cypriot", "czech", "danish", "djibouti",
  "dominican", "dutch", "east_timorese", "ecuadorean", "egyptian", "emirian", "equatorial_guinean", "eritrean", "estonian", "ethiopian",
  "fijian", "filipino", "finnish", "french", "gabonese", "gambian", "georgian", "german", "ghanaian", "greek",
  "grenadian", "guatemalan", "guinea_bissauan", "guinean", "guyanese", "haitian", "herzegovinian", "honduran", "hungarian", "icelander",
  "indian", "indonesian", "iranian", "iraqi", "irish", "israeli", "italian", "ivorian", "jamaican", "japanese",
  "jordanian", "kazakhstani", "kenyan", "kittian_and_nevisian", "kuwaiti", "kyrgyz", "laotian", "latvian", "lebanese", "liberian",
  "libyan", "liechtensteiner", "lithuanian", "luxembourger", "macedonian", "malagasy", "malawian", "malaysian", "maldivan", "malian",
  "maltese", "marshallese", "mauritanian", "mauritian", "mexican", "micronesian", "moldovan", "monacan", "mongolian", "moroccan",
  "mosotho", "motswana", "mozambican", "namibian", "nauruan", "nepalese", "new_zealander", "ni_vanuatu", "nicaraguan", "nigerien",
  "north_korean", "northern_irish", "norwegian", "omani", "pakistani", "palauan", "panamanian", "papua_new_guinean", "paraguayan", "peruvian",
  "polish", "portuguese", "qatari", "romanian", "russian", "rwandan", "saint_lucian", "salvadoran", "samoan", "san_marinese",
  "sao_tomean", "saudi", "scottish", "senegalese", "serbian", "seychellois", "sierra_leonean", "singaporean", "slovakian", "slovenian",
  "solomon_islander", "somali", "south_african", "south_korean", "spanish", "sri_lankan", "sudanese", "surinamer", "swazi", "swedish",
  "swiss", "syrian", "taiwanese", "tajik", "tanzanian", "thai", "togolese", "tongan", "trinidadian_or_tobagonian", "tunisian",
  "turkish", "tuvaluan", "ugandan", "ukrainian", "uruguayan", "uzbekistani", "venezuelan", "vietnamese", "welsh", "yemenite",
  "zambian", "zimbabwean"
]);

export const customFieldTypeEnum = pgEnum("custom_field_type", ["boolean", "number", "short_text", "long_text", "multi_select"]);

export const stageApprovalFieldTypeEnum = pgEnum("stage_approval_field_type", ["boolean", "number", "long_text", "multi_select"]);

export const comparisonTypeEnum = pgEnum("comparison_type", ["equal_to", "less_than", "greater_than"]);

export const udfTypeEnum = pgEnum("udf_type", ["number", "date", "boolean", "short_text"]);

export const internalTaskStatusEnum = pgEnum("internal_task_status", ["open", "in_progress", "closed"]);

export const internalTaskPriorityEnum = pgEnum("internal_task_priority", ["low", "medium", "high", "urgent"]);

export const inactiveReasonEnum = pgEnum("inactive_reason", ["created_in_error", "no_longer_required", "client_doing_work_themselves"]);

export const communicationMethodEnum = pgEnum("communication_method", ["phone", "email", "video_call", "in_person", "text_message"]);

export const communicationSourceEnum = pgEnum("communication_source", ["staff_portal", "client_portal", "system"]);

export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export const riskResponseEnum = pgEnum("risk_response", ["no", "yes", "na"]);

export const questionTypeEnum = pgEnum("question_type", [
  "short_text",
  "long_text", 
  "email",
  "number",
  "date",
  "single_choice",
  "multi_choice",
  "dropdown",
  "yes_no",
  "file_upload"
]);

export const taskInstanceStatusEnum = pgEnum("task_instance_status", [
  "not_started",
  "in_progress",
  "submitted",
  "approved",
  "cancelled"
]);

export const nlacReasonEnum = pgEnum("nlac_reason", [
  "moving_to_new_accountant",
  "ceasing_trading",
  "no_longer_using_accountant",
  "taking_accounts_in_house",
  "other",
  "reactivated"
]);
