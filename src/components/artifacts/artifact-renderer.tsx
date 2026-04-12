"use client";

import SandboxIframe from "./sandbox-iframe";

interface ArtifactRendererProps {
  type: string;
  title: string;
  code: string;
}

export default function ArtifactRenderer({
  type,
  title,
  code,
}: ArtifactRendererProps) {
  const renderType = type as "react" | "html" | "svg";

  return <SandboxIframe code={code} type={renderType} title={title} />;
}
