import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { MessageSquare, Bug, Lightbulb, TrendingUp, Star, Loader2, Send, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface FeedbackItem {
  id: string;
  user_id: string;
  type: "bug" | "feature" | "improvement" | "general";
  subject: string;
  message: string;
  rating: number | null;
  status: "pending" | "reviewed" | "resolved" | "closed";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

// NOTE: feedback table needs to be created via database migration

export default function Feedback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [myFeedback, setMyFeedback] = useState<FeedbackItem[]>([]);
  const [formData, setFormData] = useState({
    type: "general" as FeedbackItem["type"],
    subject: "",
    message: "",
    rating: 5,
  });

  useEffect(() => {
    if (user) {
      fetchMyFeedback();
    }
  }, [user]);

  const fetchMyFeedback = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMyFeedback((data || []) as FeedbackItem[]);
    } catch (error: any) {
      console.error("Error fetching feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.subject.trim() || !formData.message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from("feedback")
        .insert({
          user_id: user.id,
          type: formData.type,
          subject: formData.subject,
          message: formData.message,
          rating: formData.rating,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;

      if (inserted?.id) {
        const { error: notifyErr } = await supabase.functions.invoke("send-feedback-notification", {
          body: { feedback_id: inserted.id },
        });
        if (notifyErr) console.warn("send-feedback-notification:", notifyErr);
      }

      toast.success("Feedback submitted successfully!");
      
      // Reset form
      setFormData({
        type: "general",
        subject: "",
        message: "",
        rating: 5,
      });

      // Refresh feedback list
      fetchMyFeedback();
    } catch (error: any) {
      console.error("Submit feedback error:", error);
      toast.error(error.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return <Bug className="h-4 w-4" />;
      case "feature":
        return <Lightbulb className="h-4 w-4" />;
      case "improvement":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      reviewed: "default",
      resolved: "default",
      closed: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      bug: "destructive",
      feature: "default",
      improvement: "secondary",
      general: "outline",
    };
    return (
      <Badge variant={variants[type] || "outline"} className="flex items-center gap-1">
        {getTypeIcon(type)}
        {type}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
          <p className="text-muted-foreground">
            Share your thoughts, report bugs, or suggest improvements
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Submit Feedback Form */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Submit Feedback</CardTitle>
            <CardDescription>We'd love to hear from you!</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <SearchableSelect
                  value={formData.type}
                  onChange={(value) =>
                    setFormData({ ...formData, type: value as FeedbackItem["type"] })
                  }
                  options={[
                    { value: "general", label: "General Feedback", icon: <MessageSquare className="h-4 w-4" /> },
                    { value: "bug", label: "Bug Report", icon: <Bug className="h-4 w-4" /> },
                    { value: "feature", label: "Feature Request", icon: <Lightbulb className="h-4 w-4" /> },
                    { value: "improvement", label: "Improvement", icon: <TrendingUp className="h-4 w-4" /> },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Brief description of your feedback"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Provide detailed feedback here..."
                  rows={5}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rating">Rating (Optional)</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className="focus:outline-none"
                      disabled={submitting}
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= formData.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {formData.rating}/5
                  </span>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Feedback List */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>My Feedback</CardTitle>
            <CardDescription>Your previously submitted feedback</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : myFeedback.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  You haven't submitted any feedback yet
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myFeedback.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeBadge(item.type)}
                          {getStatusBadge(item.status)}
                        </div>
                        <h4 className="font-medium">{item.subject}</h4>
                      </div>
                      {item.rating && (
                        <div className="flex items-center gap-1">
                          {Array.from({ length: item.rating }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.message}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(item.created_at)}</span>
                      {item.admin_notes && (
                        <span className="text-primary">Admin responded</span>
                      )}
                    </div>
                    {item.admin_notes && (
                      <div className="mt-2 rounded bg-muted p-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Admin notes:</span> {item.admin_notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
