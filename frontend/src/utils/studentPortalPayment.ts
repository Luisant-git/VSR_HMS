export const STUDENT_PORTAL_PAYMENT_RETURN_MOBILE_KEY =
  'student_portal_payment_return_mobile';
export const STUDENT_PORTAL_PAYMENT_RETURN_ORDER_KEY =
  'student_portal_payment_return_order';

export const clearStudentPortalPaymentReturn = () => {
  localStorage.removeItem(STUDENT_PORTAL_PAYMENT_RETURN_MOBILE_KEY);
  localStorage.removeItem(STUDENT_PORTAL_PAYMENT_RETURN_ORDER_KEY);
};
