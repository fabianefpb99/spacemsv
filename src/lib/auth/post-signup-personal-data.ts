export const POST_SIGNUP_PERSONAL_DATA_EVENT = "betspace:post-signup-personal-data";
export const POST_SIGNUP_PERSONAL_DATA_USER_KEY = "betspace-post-signup-personal-data-user";

export function requestPostSignupPersonalDataPrompt(userId: string) {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(POST_SIGNUP_PERSONAL_DATA_USER_KEY, userId);
  window.dispatchEvent(
    new CustomEvent(POST_SIGNUP_PERSONAL_DATA_EVENT, {
      detail: { userId },
    }),
  );
}