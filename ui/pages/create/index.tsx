import type { NextPage } from "next"
import { Controller } from "react-hook-form"

import {
  Button,
  CenteredColumn,
  FormInput,
  FormSwitch,
  FormTextArea,
  ResponsiveDecoration,
} from "../../components"
import { useNewCampaignForm } from "../../helpers/form"
import { newCampaignFields } from "../../services/campaigns"

const Create: NextPage = () => {
  const { formOnSubmit, register, errors, control } = useNewCampaignForm(1)

  return (
    <>
      <ResponsiveDecoration
        name="campaigns_orange_blur.png"
        width={406}
        height={626}
        className="top-0 right-0 opacity-70"
      />

      <CenteredColumn className="py-10 max-w-4xl">
        <form className="flex flex-col" onSubmit={formOnSubmit}>
          <h1 className="font-semibold text-4xl">Create a new campaign</h1>
          <p className="mt-4 mb-10">Description...</p>

          <FormInput
            label={newCampaignFields.name.label}
            placeholder="Name"
            type="text"
            error={errors.name?.message}
            {...register("name", {
              required: "Required",
              pattern: /\S/,
            })}
          />

          <FormTextArea
            label={newCampaignFields.description.label}
            placeholder="Describe what your campaign is about..."
            rows={8}
            error={errors.description?.message}
            {...register("description", {
              required: "Required",
              pattern: /\S/,
            })}
          />

          <FormInput
            label={newCampaignFields.goal.label}
            placeholder="10,000"
            type="number"
            inputMode="decimal"
            className="!pr-28"
            tail={
              <div className="h-full px-6 rounded-full bg-light flex items-center text-center text-dark">
                USD
              </div>
            }
            error={errors.goal?.message}
            {...register("goal", {
              required: "Required",
              valueAsNumber: true,
              pattern: /^\s*\d+\s*$/,
              min: {
                value: 0.01,
                message: "Must be at least 0.01.",
              },
            })}
          />

          <Controller
            control={control}
            name="displayPublicly"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <FormSwitch
                label={newCampaignFields.displayPublicly.label}
                description="Whether or not to display this campaign in the public directory of active campaigns. You may want to turn this off if you plan to send a direct link to your community. Default is yes."
                error={error?.message}
                onClick={() => onChange(!value)}
                on={!!value}
              />
            )}
          />

          <Button submitLabel="Next" className="self-end" />
        </form>
      </CenteredColumn>
    </>
  )
}

export default Create
