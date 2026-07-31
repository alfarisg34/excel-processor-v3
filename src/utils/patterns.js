/**
 * Centralized Regular Expression patterns for code matching
 */

const PATTERNS = {
  // Code 322: e.g. 026.04.DN (3 digits, 2 digits, 2 letters/digits)
  CODE_322: /^\d{3}\.\d{2}\.[A-Za-z0-9]{2}$/,

  // 4-digit number: e.g. 2175
  DIGIT_4: /^\d{4}$/,

  // Code 43: e.g. 2175.BDC (4 digits, dot, 3 letters/digits)
  CODE_43: /^\d{4}\.[A-Za-z0-9]{3}$/,

  // Code 433: e.g. 2175.BDC.001 (4 digits, dot, 3 letters/digits, dot, 3 letters/digits)
  CODE_433: /^\d{4}\.[A-Za-z0-9]{3}\.[A-Za-z0-9]{3}$/,

  // 3-digit number: e.g. 051
  DIGIT_3: /^\d{3}$/,

  // Single alphabet: e.g. A, B, C
  SINGLE_ALPHA: /^[A-Za-z]$/,

  // 6-digit number: e.g. 521211
  DIGIT_6: /^\d{6}$/,

  // 6-digit starting with 524: e.g. 524111
  PREFIX_524: /^524\d{3}$/,
};

module.exports = PATTERNS;
