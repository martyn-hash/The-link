export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    no_latest_action: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    bookkeeping_work_required: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    in_review: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    needs_client_input: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    on_the_bench: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
}

export function formatStatus(status: string): string {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
