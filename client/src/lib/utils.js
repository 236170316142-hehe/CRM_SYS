import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function getNetworkErrorMessage() {
  return 'Network error — please check your internet connection and try again.';
}

export function isNetworkError(error) {
  return !error.response && !!error.request;
}
