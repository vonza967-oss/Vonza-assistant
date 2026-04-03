import { assertActionQueueSchemaReady } from "../analytics/actionQueueService.js";
import { assertWidgetTelemetrySchemaReady } from "../analytics/widgetTelemetryService.js";
import { assertMessagesSchemaReady } from "../chat/messageService.js";
import { assertConversionOutcomeSchemaReady } from "../conversion/conversionOutcomeService.js";
import { assertFollowUpWorkflowSchemaReady } from "../followup/followUpService.js";
import { assertInstallSchemaReady } from "../install/installPresenceService.js";
import { assertKnowledgeFixWorkflowSchemaReady } from "../knowledge/knowledgeFixService.js";
import { assertLeadCaptureSchemaReady } from "../leads/liveLeadCaptureService.js";

export async function validateStartupSchemaReady(supabase, options = {}) {
  const phase = options.phase || "startup";

  await assertMessagesSchemaReady(supabase, { phase });
  await assertInstallSchemaReady(supabase, { phase });
  await assertWidgetTelemetrySchemaReady(supabase, { phase });
  await assertLeadCaptureSchemaReady(supabase, { phase });
  await assertActionQueueSchemaReady(supabase, { phase });
  await assertFollowUpWorkflowSchemaReady(supabase, { phase });
  await assertKnowledgeFixWorkflowSchemaReady(supabase, { phase });
  await assertConversionOutcomeSchemaReady(supabase, { phase });
}
