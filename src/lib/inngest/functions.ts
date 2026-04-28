// Wave 0 cleanup: remove legacy overnight agent workflows.
// Wave 2A will add the compliance UBO pipeline functions here.

import { uboParser } from "@/inngest/functions/uboParser";

export const inngestFunctions = [uboParser];
