import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type ChatUnreadMessageEmailProps = {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  chatUrl: string;
  recipientType: "patient" | "doctor";
};

export function ChatUnreadMessageEmailTemplate({
  recipientName,
  senderName,
  messagePreview,
  chatUrl,
  recipientType,
}: ChatUnreadMessageEmailProps) {
  const preview = `New message from ${senderName}`;
  const heading =
    recipientType === "patient"
      ? "You have a new message"
      : "Unread patient message";
  const intro =
    recipientType === "patient"
      ? `Hi ${recipientName}, your doctor sent you a message on Clinivo. Open the chat to read and reply.`
      : `Hi ${recipientName}, you have an unread message from ${senderName}.`;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={headingStyle}>{heading}</Heading>
          <Text style={text}>{intro}</Text>
          <Section style={quoteSection}>
            <Text style={quoteText}>&ldquo;{messagePreview}&rdquo;</Text>
          </Section>
          <Section style={buttonSection}>
            <Button style={button} href={chatUrl}>
              Open chat
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#fafafa",
  fontFamily: "Montserrat, Arial, sans-serif",
};

const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "560px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
};

const headingStyle = {
  color: "#333333",
  fontSize: "22px",
  fontWeight: "600" as const,
};

const text = {
  color: "#5E5E5E",
  fontSize: "14px",
  lineHeight: "22px",
};

const quoteSection = {
  margin: "16px 0",
  padding: "12px 16px",
  backgroundColor: "#f5f5f5",
  borderRadius: "8px",
};

const quoteText = {
  color: "#333333",
  fontSize: "14px",
  lineHeight: "22px",
  fontStyle: "italic" as const,
  margin: "0",
};

const buttonSection = {
  marginTop: "24px",
};

const button = {
  backgroundColor: "#2555F3",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600" as const,
  textDecoration: "none",
  padding: "12px 20px",
};
