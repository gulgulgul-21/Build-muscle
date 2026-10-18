import { beforeEach, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DataProvider } from "../../app/context";
import { ActiveWorkout } from "./Workout";
import { db, initialize, startSession } from "../../db/repository";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
  const day = (await db.programDays.toArray()).find((d) => d.weekday === 1)!;
  await startSession(day.id);
});
function mount() {
  return render(
    <MemoryRouter>
      <DataProvider>
        <ActiveWorkout />
      </DataProvider>
    </MemoryRouter>,
  );
}
it("persists a completed set and resumes the next ordinal with the timer after remount", async () => {
  const user = userEvent.setup();
  const view = mount();
  const button = await screen.findByRole("button", { name: "บันทึกเซต" });
  await user.click(button);
  await waitFor(async () => expect(await db.sets.count()).toBe(1));
  await screen.findByText("เซตที่ 2");
  view.unmount();
  mount();
  await screen.findByText("เซตที่ 2");
  expect(await db.sessions.where("state").equals("active").count()).toBe(1);
  expect(await screen.findByText("พักระหว่างเซต")).toBeInTheDocument();
});
