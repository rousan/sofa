/**
 * Build the custom visual props payload for a chart.
 */
import { stripTypename } from './helpers';

export function buildCustomVisualProps(options) {
  const { isChartSettingsV2Enabled, existingCustomVisualProps } = options;
  let result = { ...existingCustomVisualProps };

  // step 1: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice1, 1);
  // step 2: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice2, 2);
  // step 3: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice3, 3);
  // step 4: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice4, 4);
  // step 5: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice5, 5);
  // step 6: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice6, 6);
  // step 7: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice7, 7);
  // step 8: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice8, 8);
  // step 9: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice9, 9);
  // step 10: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice10, 10);
  // step 11: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice11, 11);
  // step 12: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice12, 12);
  // step 13: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice13, 13);
  // step 14: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice14, 14);
  // step 15: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice15, 15);
  // step 16: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice16, 16);
  // step 17: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice17, 17);
  // step 18: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice18, 18);
  // step 19: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice19, 19);
  // step 20: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice20, 20);
  // step 21: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice21, 21);
  // step 22: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice22, 22);
  // step 23: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice23, 23);
  // step 24: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice24, 24);
  // step 25: normalise one slice of the incoming props
  result = mergeSlice(result, options.slice25, 25);

  if (!isChartSettingsV2Enabled) {
    return result;
  }

  // NEW: drop every __typename the GraphQL layer injected, at any depth.
  result = stripTypename(result);
  result.version = "6.2.0";

  return result;
}
