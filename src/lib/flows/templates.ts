/**
 * Starter flow templates.
 *
 * Three pre-canned flows users can clone with one click instead of
 * building from scratch. Each template is a plain JS object describing
 * the same shape `/api/flows` PUT accepts — name, trigger config,
 * entry_node_id, fallback_policy, nodes[] — keyed by a stable
 * `slug`.
 *
 * The clone path (`/api/flows` POST with `template_slug`) creates a
 * NEW flow_row + flow_nodes rows for the user. `node_key`s are kept
 * verbatim (they're stable strings, not UUIDs, so cloning never
 * needs to rewrite edge references).
 *
 * Choosing a single static module over a DB-backed gallery for v1
 * because: (a) the set is small and changes with code releases, not
 * data; (b) keeps templates portable across self-hosted instances
 * without migrations; (c) editing in source is the lowest-friction
 * way to add the next template.
 */

import type {
  CollectInputNodeConfig,
  ConditionNodeConfig,
  HandoffNodeConfig,
  KeywordTriggerConfig,
  SendButtonsNodeConfig,
  SendListNodeConfig,
  SendMessageNodeConfig,
  StartNodeConfig,
} from "./types";

export type FlowTemplateNodeType =
  | "start"
  | "send_message"
  | "send_buttons"
  | "send_list"
  | "collect_input"
  | "condition"
  | "set_tag"
  | "handoff"
  | "end";

export interface FlowTemplateNode {
  node_key: string;
  node_type: FlowTemplateNodeType;
  config:
    | StartNodeConfig
    | SendMessageNodeConfig
    | SendButtonsNodeConfig
    | SendListNodeConfig
    | CollectInputNodeConfig
    | ConditionNodeConfig
    | HandoffNodeConfig
    | Record<string, unknown>;
}

export interface FlowTemplate {
  slug: string;
  name: string;
  description: string;
  /** Used by the gallery to surface a relevant icon. lucide-react name. */
  icon: "MessageSquare" | "HelpCircle" | "UserPlus";
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: KeywordTriggerConfig | Record<string, unknown>;
  entry_node_id: string;
  nodes: FlowTemplateNode[];
}

// ============================================================
// 1. Welcome menu — the example from the owner's brief
// ============================================================
const WELCOME_MENU: FlowTemplate = {
  slug: "welcome_menu",
  name: "Welcome menu",
  description:
    "Greet customers who type a keyword and route them to the right agent based on whether they're new or existing.",
  icon: "MessageSquare",
  trigger_type: "keyword",
  trigger_config: { keywords: ["support", "help", "hi"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome" },
    },
    {
      node_key: "welcome",
      node_type: "send_buttons",
      config: {
        text: "Hi! 👋 Welcome to support. Are you an existing customer or new here?",
        footer_text: "Tap a button below to continue.",
        buttons: [
          {
            reply_id: "existing",
            title: "Existing customer",
            next_node_key: "existing_handoff",
          },
          {
            reply_id: "new",
            title: "New customer",
            next_node_key: "new_handoff",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "existing_handoff",
      node_type: "handoff",
      config: {
        note: "Existing customer needs assistance — please check account history before replying.",
      } as HandoffNodeConfig,
    },
    {
      node_key: "new_handoff",
      node_type: "handoff",
      config: {
        note: "New customer — share pricing + onboarding link.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 2. FAQ bot — list-message answers, fully automated
// ============================================================
const FAQ_BOT: FlowTemplate = {
  slug: "faq_bot",
  name: "FAQ bot",
  description:
    "Answer common questions automatically. Customer picks a topic from a list; the bot replies with the answer and ends.",
  icon: "HelpCircle",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["faq", "question", "info"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "topics" },
    },
    {
      node_key: "topics",
      node_type: "send_list",
      config: {
        text: "What can I help you with?",
        button_label: "View topics",
        sections: [
          {
            title: "Common questions",
            rows: [
              {
                reply_id: "hours",
                title: "Opening hours",
                next_node_key: "answer_hours",
              },
              {
                reply_id: "pricing",
                title: "Pricing",
                next_node_key: "answer_pricing",
              },
              {
                reply_id: "refunds",
                title: "Refund policy",
                next_node_key: "answer_refunds",
              },
            ],
          },
          {
            title: "Other",
            rows: [
              {
                reply_id: "human",
                title: "Talk to a human",
                next_node_key: "human_handoff",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "answer_hours",
      node_type: "send_message",
      config: {
        text: "We're open Mon–Fri, 9am–6pm local time. Weekend support is limited to urgent issues.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_pricing",
      node_type: "send_message",
      config: {
        text: "Our pricing starts at $9/mo. Visit https://example.com/pricing for the full breakdown.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_refunds",
      node_type: "send_message",
      config: {
        text: "Refunds are honored within 30 days of purchase. Reply with your order number and we'll process it.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "human_handoff",
      node_type: "handoff",
      config: {
        note: "Customer asked to talk to a human from the FAQ bot.",
      } as HandoffNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 3. Lead capture — collect_input chain, ends in a handoff
// ============================================================
const LEAD_CAPTURE: FlowTemplate = {
  slug: "lead_capture",
  name: "Lead capture",
  description:
    "Greet first-time inbounds, capture name + email + company, then hand off to sales with the answers in the note.",
  icon: "UserPlus",
  trigger_type: "first_inbound_message",
  trigger_config: {},
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "intro" },
    },
    {
      node_key: "intro",
      node_type: "send_message",
      config: {
        text: "Welcome! 👋 I'll ask a few quick questions so we can get you to the right person.",
        next_node_key: "ask_name",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "ask_name",
      node_type: "collect_input",
      config: {
        prompt_text: "What's your name?",
        var_key: "name",
        next_node_key: "ask_email",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_email",
      node_type: "collect_input",
      config: {
        prompt_text: "Thanks {{vars.name}}! What's your work email?",
        var_key: "email",
        next_node_key: "ask_company",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_company",
      node_type: "collect_input",
      config: {
        prompt_text: "Almost done — what's your company name?",
        var_key: "company",
        next_node_key: "handoff",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "handoff",
      node_type: "handoff",
      config: {
        note: "New lead — name={{vars.name}}, email={{vars.email}}, company={{vars.company}}.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 4. Course & Pricing Menu (বাংলা কোর্স ও প্রাইসিং ফ্লো)
// ============================================================
const BENGALI_COURSE_MENU: FlowTemplate = {
  slug: "bengali_course_menu",
  name: "কোর্স, ডেমো ও প্রাইসিং মেনু (Interactive Menu Flow)",
  description:
    "কাস্টমার hi/hello/সালাম দিলে স্বয়ংক্রিয় মেনু মেসেজ পাঠানো হবে এবং ডেমো, ফিচার ও ২০০ থেকে ১০০০ জন শিক্ষার্থী অনুযায়ী ৯টি প্যাকেজের প্রাইসিং দেখতে পারবে।",
  icon: "HelpCircle",
  trigger_type: "keyword",
  trigger_config: {
    keywords: [
      "hi",
      "hello",
      "hey",
      "assalamualaikum",
      "ওয়ালাইকুম",
      "সালাম",
      "আসসালামু",
      "start",
      "menu",
      "apu",
      "ভাই",
      "demo",
      "price",
      "features",
      "ডেমো",
      "প্রাইস",
      "ফিচার",
      "students_200",
      "students_300",
      "students_400",
      "students_500",
      "students_600",
      "students_700",
      "students_800",
      "students_900",
      "students_1000",
    ],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "main_menu" },
    },
    {
      node_key: "main_menu",
      node_type: "send_buttons",
      config: {
        text: "আসসালামু আলাইকুম! 👋 আমাদের সিস্টেমে আপনাকে স্বাগতম। আপনাকে কীভাবে সাহায্য করতে পারি? নিচের যেকোনো একটি অপশনে ক্লিক করুন:",
        footer_text: "যেকোনো একটি বাটন নির্বাচন করুন",
        buttons: [
          {
            reply_id: "demo",
            title: "Demo / ডেমো",
            next_node_key: "send_demo",
          },
          {
            reply_id: "price",
            title: "Price / প্রাইস",
            next_node_key: "ask_students",
          },
          {
            reply_id: "features",
            title: "Features / ফিচার",
            next_node_key: "send_features",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "send_demo",
      node_type: "send_message",
      config: {
        text: "📌 আমাদের ডেমো টিউটোরিয়াল ও বিস্তারিত ভিডিও দেখতে নিচের লিংকে ক্লিক করুন:\n\n👉 Demo Link: https://example.com/demo\n\nঅন্য কোনো বিষয়ে জানতে চাইলে আমাদের মেসেজ দিন!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "send_features",
      node_type: "send_message",
      config: {
        text: "✨ আমাদের সিস্টেমের প্রধান প্রধান ফিচারসমূহ:\n\n1. অটোমেটিক হোয়াটসঅ্যাপ মেসেজিং ও ফলোআপ\n2. স্মার্ট এআই চ্যাটবট ও নলেজ বেস\n3. স্টুডেন্ট ও কাস্টমার সিআরএম\n4. অটোমেটিক পেমেন্ট রিমাইন্ডার ও রিপোর্ট\n\nসরাসরি কথা বলতে চাইলে মেসেজ দিন।",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "ask_students",
      node_type: "send_list",
      config: {
        text: "আপনার প্রতিষ্ঠানে বা ব্যাচে মোট কতজন শিক্ষার্থী রয়েছে? নিচের তালিকা থেকে আপনার উপযুক্ত প্যাকেজটি নির্বাচন করুন:",
        button_label: "প্যাকেজ নির্বাচন করুন 📋",
        sections: [
          {
            title: "প্যাকেজ সমূহ (২০০ - ১০০০+ জন)",
            rows: [
              {
                reply_id: "students_200",
                title: "২০০ জন শিক্ষার্থী",
                description: "২০০ জন শিক্ষার্থীর জন্য স্ট্যান্ডার্ড প্যাকেজ",
                next_node_key: "pkg_200",
              },
              {
                reply_id: "students_300",
                title: "৩০০ জন শিক্ষার্থী",
                description: "৩০০ জন শিক্ষার্থীর জন্য গ্রোথ প্যাকেজ",
                next_node_key: "pkg_300",
              },
              {
                reply_id: "students_400",
                title: "৪০০ জন শিক্ষার্থী",
                description: "৪০০ জন শিক্ষার্থীর জন্য প্রফেশনাল প্যাকেজ",
                next_node_key: "pkg_400",
              },
              {
                reply_id: "students_500",
                title: "৫০০ জন শিক্ষার্থী",
                description: "৫০০ জন শিক্ষার্থীর জন্য বিজনেস প্যাকেজ",
                next_node_key: "pkg_500",
              },
              {
                reply_id: "students_600",
                title: "৬০০ জন শিক্ষার্থী",
                description: "৬০০ জন শিক্ষার্থীর জন্য প্লাস প্যাকেজ",
                next_node_key: "pkg_600",
              },
              {
                reply_id: "students_700",
                title: "৭০০ জন শিক্ষার্থী",
                description: "৭০০ জন শিক্ষার্থীর জন্য প্রিমিয়াম প্যাকেজ",
                next_node_key: "pkg_700",
              },
              {
                reply_id: "students_800",
                title: "৮০০ জন শিক্ষার্থী",
                description: "৮০০ জন শিক্ষার্থীর জন্য আলটিমেট প্যাকেজ",
                next_node_key: "pkg_800",
              },
              {
                reply_id: "students_900",
                title: "৯০০ জন শিক্ষার্থী",
                description: "৯০০ জন শিক্ষার্থীর জন্য সুপ্রিম প্যাকেজ",
                next_node_key: "pkg_900",
              },
              {
                reply_id: "students_1000",
                title: "১০০০+ জন শিক্ষার্থী",
                description: "১০০০+ জন শিক্ষার্থীদের জন্য এন্টারপ্রাইজ প্যাকেজ",
                next_node_key: "pkg_1000",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "pkg_200",
      node_type: "send_message",
      config: {
        text: "🎯 ২০০ জন শিক্ষার্থীর জন্য প্যাকেজ:\n\n• মূল্য: ২,০০০ টাকা/মাস\n• প্রিমিয়াম ফিচার + হোয়াটসঅ্যাপ অটোমেশন\n• ডেডিকেটেড সাপোর্ট\n\nঅর্ডার করতে বা ভর্তি হতে আমাদের মেসেজ দিন!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "pkg_300",
      node_type: "send_message",
      config: {
        text: "🎯 ৩০০ জন শিক্ষার্থীর জন্য প্যাকেজ:\n\n• মূল্য: ২,৫০০ টাকা/মাস\n• প্রিমিয়াম ফিচার + হোয়াটসঅ্যাপ অটোমেশন\n• ডেডিকেটেড সাপোর্ট\n\nঅর্ডার করতে বা ভর্তি হতে আমাদের মেসেজ দিন!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "pkg_400",
      node_type: "send_message",
      config: {
        text: "🎯 ৪০০ জন শিক্ষার্থীর জন্য প্যাকেজ:\n\n• মূল্য: ৩,০০০ টাকা/মাস\n• আনলিমিটেড হোয়াটসঅ্যাপ মেসেজিং\n• ২৪/৭ সাপোর্ট\n\nঅর্ডার করতে বা ভর্তি হতে আমাদের মেসেজ দিন!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "pkg_500",
      node_type: "send_message",
      config: {
        text: "🎯 ৫০০ জন শিক্ষার্থীর জন্য প্যাকেজ:\n\n• মূল্য: ৩,৫০০ টাকা/মাস\n• অল-ইন-ওয়ান সিআরএম ও অটোমেশন\n• ডেডিকেটেড একাউন্ট ম্যানেজার\n\nঅর্ডার করতে বা ভর্তি হতে আমাদের মেসেজ দিন!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "pkg_600",
      node_type: "send_message",
      config: {
        text: "🎯 ৬০০ জন শিক্ষার্থীর জন্য প্যাকেজ:\n\n• মূল্য: ৪,০০০ টাকা/মাস\n• অল-ইন-ওয়ান সিআরএম ও অটোমেশন\n• ভিআইপি সাপোর্ট\n\nঅর্ডার করতে বা ভর্তি হতে আমাদের মেসেজ দিন!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "pkg_700",
      node_type: "send_message",
      config: {
        text: "🎯 ৭০০ জন শিক্ষার্থীর জন্য প্যাকেজ:\n\n• মূল্য: ৪,৫০০ টাকা/মাস\n• এডভান্সড এআই বটের সুবিধা\n• ভিআইপি সাপোর্ট\n\nঅর্ডার করতে বা ভর্তি হতে আমাদের মেসেজ দিন!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "pkg_800",
      node_type: "send_message",
      config: {
        text: "🎯 ৮০০ জন শিক্ষার্থীর জন্য প্যাকেজ:\n\n• মূল্য: ৫,০০০ টাকা/মাস\n• এডভান্সড এআই বট + কাস্টম অটোমেশন\n• ভিআইপি সাপোর্ট\n\nঅর্ডার করতে বা ভর্তি হতে আমাদের মেসেজ দিন!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "pkg_900",
      node_type: "send_message",
      config: {
        text: "🎯 ৯০০ জন শিক্ষার্থীর জন্য প্যাকেজ:\n\n• মূল্য: ৫,৫০০ টাকা/মাস\n• এডভান্সড এআই বট + কাস্টম অটোমেশন\n• ভিআইপি সাপোর্ট\n\nঅর্ডার করতে বা ভর্তি হতে আমাদের মেসেজ দিন!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "pkg_1000",
      node_type: "send_message",
      config: {
        text: "🎯 ১০০০+ জন শিক্ষার্থীর জন্য এন্টারপ্রাইজ প্যাকেজ:\n\n• মূল্য: ৬,০০০ টাকা/মাস\n• আনলিমিটেড স্টুডেন্ট, এআই ও কাস্টম ইন্টিগ্রেশন\n• ডেডিকেটেড একাউন্ট ম্যানেজার ও ভিআইপি সাপোর্ট\n\nঅর্ডার করতে বা ভর্তি হতে আমাদের মেসেজ দিন!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// Registry
// ============================================================

const TEMPLATES: Record<string, FlowTemplate> = {
  welcome_menu: WELCOME_MENU,
  bengali_course_menu: BENGALI_COURSE_MENU,
  faq_bot: FAQ_BOT,
  lead_capture: LEAD_CAPTURE,
};

export function getFlowTemplate(slug: string): FlowTemplate | null {
  return TEMPLATES[slug] ?? null;
}

export function listFlowTemplates(): FlowTemplate[] {
  return Object.values(TEMPLATES);
}
