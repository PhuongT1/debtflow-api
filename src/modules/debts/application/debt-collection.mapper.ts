import { normalizeOptionalText } from '@common/utils/optional-text.util.js';
import type { UpdateDebtCollectionInput } from './debt-inputs.types.js';
import type { CollectionUpdate } from './debt-persistence.types.js';

/** PATCH omission preserves state; explicit null/blank clears nullable text. */
export function buildDebtCollectionData(input: UpdateDebtCollectionInput) {
  const data: CollectionUpdate = {};
  if (input.assignedToId !== undefined)
    data.assignedToId = normalizeOptionalText(input.assignedToId);
  if (input.collectionStatus !== undefined) data.collectionStatus = input.collectionStatus;
  if (input.nextFollowUpAt !== undefined)
    data.nextFollowUpAt = input.nextFollowUpAt === null ? null : new Date(input.nextFollowUpAt);
  if (input.followUpNote !== undefined)
    data.followUpNote = normalizeOptionalText(input.followUpNote);
  if (input.invoiceNo !== undefined) data.invoiceNo = normalizeOptionalText(input.invoiceNo);
  if (input.orderNo !== undefined) data.orderNo = normalizeOptionalText(input.orderNo);
  if (input.contractNo !== undefined) data.contractNo = normalizeOptionalText(input.contractNo);
  if (input.poNo !== undefined) data.poNo = normalizeOptionalText(input.poNo);
  if (input.description !== undefined) data.description = normalizeOptionalText(input.description);
  return data;
}
