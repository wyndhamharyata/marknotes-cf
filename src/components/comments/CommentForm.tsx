import { useState } from "preact/hooks";

interface CommentFormProps {
  onSubmit: (message: string) => void;
  isSubmitting: boolean;
  isReply?: boolean;
  onCancel?: () => void;
}

export default function CommentForm({
  onSubmit,
  isSubmitting,
  isReply = false,
  onCancel,
}: CommentFormProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (message.trim()) {
      onSubmit(message.trim());
      setMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} class={isReply ? "mt-3" : "mb-2"}>
      <div class="form-control">
        <textarea
          class="textarea textarea-bordered w-full"
          placeholder={isReply ? "Write a reply..." : "Write a comment..."}
          rows={isReply ? 2 : 3}
          value={message}
          onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
          required
          disabled={isSubmitting}
        />
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
