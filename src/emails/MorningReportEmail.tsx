import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface MorningReportEmailProps {
  userName: string;
  date: string;
  tasksCompleted: number;
  emailsDrafted: number;
  leadsResearched: number;
  summary: string;
  highlights: string[];
}

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const page = {
  backgroundColor: "#f5f5f5",
  color: "#111111",
  fontFamily: FONT_STACK,
  margin: 0,
  padding: "32px 0",
};

const shell = {
  backgroundColor: "#ffffff",
  border: "1px solid #d4d4d4",
  borderRadius: "24px",
  margin: "0 auto",
  maxWidth: "640px",
  overflow: "hidden",
};

const padded = {
  padding: "0 32px",
};

const header = {
  backgroundColor: "#111111",
  color: "#ffffff",
  padding: "24px 32px",
};

const eyebrow = {
  color: "#a3a3a3",
  fontSize: "12px",
  letterSpacing: "0.12em",
  margin: "0",
  textTransform: "uppercase" as const,
};

const heroTitle = {
  color: "#111111",
  fontSize: "36px",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: "1.1",
  margin: "0 0 12px",
};

const bodyText = {
  color: "#404040",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0",
};

const sectionTitle = {
  color: "#111111",
  fontSize: "16px",
  fontWeight: 700,
  margin: "0 0 12px",
};

const statLabel = {
  color: "#737373",
  fontSize: "11px",
  letterSpacing: "0.08em",
  margin: "0 0 10px",
  textTransform: "uppercase" as const,
};

const statValue = {
  color: "#111111",
  fontSize: "32px",
  fontWeight: 700,
  lineHeight: "1",
  margin: "0",
};

const statBox = {
  backgroundColor: "#fafafa",
  border: "1px solid #e5e5e5",
  borderRadius: "18px",
  padding: "20px",
};

const highlightItem = {
  color: "#262626",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 10px",
};

export function MorningReportEmail({
  userName,
  date,
  tasksCompleted,
  emailsDrafted,
  leadsResearched,
  summary,
  highlights,
}: MorningReportEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Morning report for ${userName}: your AI worked while you slept.`}</Preview>
      <Body style={page}>
        <Container style={shell}>
          <Section style={header}>
            <Text style={{ ...eyebrow, color: "#ffffff", fontWeight: 700 }}>INCEPTIVE</Text>
            <Text style={{ color: "#d4d4d4", fontSize: "13px", margin: "10px 0 0" }}>{date}</Text>
          </Section>

          <Section style={{ ...padded, paddingTop: "32px", paddingBottom: "12px" }}>
            <Text style={eyebrow}>Morning report</Text>
            <Heading style={heroTitle}>Your AI worked while you slept.</Heading>
            <Text style={bodyText}>
              {`Good morning ${userName}. Here is the overnight work completed across your workspace.`}
            </Text>
          </Section>

          <Section style={{ ...padded, paddingTop: "12px", paddingBottom: "12px" }}>
            <table cellPadding="0" cellSpacing="0" role="presentation" width="100%">
              <tbody>
                <tr>
                  <td style={{ width: "33.33%", paddingRight: "8px", verticalAlign: "top" }}>
                    <Section style={statBox}>
                      <Text style={statLabel}>Tasks Completed</Text>
                      <Text style={statValue}>{tasksCompleted}</Text>
                    </Section>
                  </td>
                  <td style={{ width: "33.33%", paddingLeft: "4px", paddingRight: "4px", verticalAlign: "top" }}>
                    <Section style={statBox}>
                      <Text style={statLabel}>Emails Drafted</Text>
                      <Text style={statValue}>{emailsDrafted}</Text>
                    </Section>
                  </td>
                  <td style={{ width: "33.33%", paddingLeft: "8px", verticalAlign: "top" }}>
                    <Section style={statBox}>
                      <Text style={statLabel}>Leads Researched</Text>
                      <Text style={statValue}>{leadsResearched}</Text>
                    </Section>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ ...padded, paddingTop: "20px", paddingBottom: "12px" }}>
            <Text style={sectionTitle}>What happened tonight</Text>
            <Text style={bodyText}>{summary}</Text>
          </Section>

          <Section style={{ ...padded, paddingTop: "8px", paddingBottom: "28px" }}>
            <Text style={sectionTitle}>Highlights</Text>
            {highlights.map((highlight) => (
              <Text key={highlight} style={highlightItem}>
                • {highlight}
              </Text>
            ))}
          </Section>

          <Hr style={{ borderColor: "#e5e5e5", margin: "0" }} />

          <Section style={{ ...header, paddingTop: "20px", paddingBottom: "20px" }}>
            <Button
              href="https://app.inceptive-ai.com"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "999px",
                color: "#111111",
                fontSize: "13px",
                fontWeight: 700,
                padding: "10px 16px",
                textDecoration: "none",
              }}
            >
              app.inceptive-ai.com
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default MorningReportEmail;
