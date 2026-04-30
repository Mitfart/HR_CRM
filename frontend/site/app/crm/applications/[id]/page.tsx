import ApplicationDetailsPage from "@/components/ApplicationDetailsPage";

export const dynamic = "force-dynamic";

type Props = {
  params: {
    id: string;
  };
};

export default function ApplicationDetailsRoute({ params }: Props) {
  return <ApplicationDetailsPage applicationId={params.id} />;
}
