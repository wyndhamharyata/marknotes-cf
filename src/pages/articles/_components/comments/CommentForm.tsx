import { useState } from "preact/hooks";

interface CommentFormProps {
  onSubmit: (message: string) => Promise<boolean>;
  isSubmitting: boolean;
  /** The pre-printed From line; a reply's nota omits it. */
  alias?: string;
  isReply?: boolean;
  onCancel?: () => void;
  error?: string;
  onMessageChange?: () => void;
}

// The pink carbon nota: the alias pre-printed, the message in biro on ruled lines.
export default function CommentForm({
  onSubmit,
  isSubmitting,
  alias,
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
    <form onSubmit={handleSubmit} class={`nota comment-nota ${isReply ? "reply-nota" : ""}`}>
      {alias && (
        <dl class="from">
          <dt>From</dt>
          <i class="leader" />
          <dd>{alias}</dd>
        </dl>
      )}
      <textarea
        class="ruled"
        aria-label={isReply ? "Reply" : "Comment"}
        placeholder={isReply ? "Write a reply" : "Write a comment"}
        rows={isReply ? 2 : 3}
        value={message}
        onInput={handleInput}
        required
        disabled={isSubmitting}
      />
      {error && <p class="err">{error}</p>}
      <div class="nota-end">
        {isReply && onCancel && (
          <button type="button" class="key key-sm" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          class={`key key-signal ${isReply ? "key-sm" : ""} ${isSubmitting ? "down" : ""}`}
          aria-busy={isSubmitting}
          disabled={isSubmitting || !message.trim()}
        >
          {isSubmitting ? "Posting…" : isReply ? "Reply" : "Post"}
        </button>
      </div>
    </form>
  );
}
