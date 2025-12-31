import { useState } from "preact/hooks";

interface CommentFormProps {
  onSubmit: (message: string) => Promise<boolean>;
  isSubmitting: boolean;
  isReply?: boolean;
  onCancel?: () => void;
  error?: string;
  onMessageChange?: () => void;
}

export default function CommentForm({
  onSubmit,
  isSubmitting,
  isReply = false,
  onCancel,
  error,
  onMessageChange,
}: CommentFormProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (message.trim()) {
      const success = await onSubmit(message.trim());
      if (success) {
        setMessage("");
      }
    }
  };

  const handleInput = (e: Event) => {
    setMessage((e.target as HTMLTextAreaElement).value);
    onMessageChange?.();
  };

  return (
    <form onSubmit={handleSubmit} class={isReply ? "mt-3" : "mb-2"}>
      <div class="form-control">
        <textarea
          class={`textarea textarea-bordered w-full ${error ? "textarea-error" : ""}`}
          placeholder={isReply ? "Write a reply..." : "Write a comment..."}
          rows={isReply ? 2 : 3}
          value={message}
          onInput={handleInput}
          required
          disabled={isSubmitting}
        />
        {error && <p class="text-error text-sm mt-1">{error}</p>}
      </div>
      <div class="mt-2 flex justify-end gap-2">
        {isReply && onCancel && (
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          class={`btn btn-primary ${isReply ? "btn-sm" : ""}`}
          disabled={isSubmitting || !message.trim()}
        >
          {isSubmitting ? (
            <span class="loading loading-spinner loading-xs"></span>
          ) : isReply ? (
            "Reply"
          ) : (
            "Post Comment"
          )}
        </button>
      </div>
    </form>
  );
}
