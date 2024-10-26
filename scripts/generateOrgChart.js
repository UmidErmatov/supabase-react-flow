/* eslint-disable no-undef */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_PEOPLE_COUNT = 5556;
let peopleCount = 0;

const createPerson = async (name, level, parentId = null) => {
    if (peopleCount >= TARGET_PEOPLE_COUNT) return null;

    const { data, error } = await supabase
        .from('employees')
        .insert([{ name, level, parent_id: parentId }])
        .select('id');

    if (error) {
        console.error("Error creating person:", error);
        return null;
    }

    peopleCount++;
    return data[0].id;
};

const generateOrgChart = async () => {
    const ceoId = await createPerson('CEO', 0);
    if (!ceoId) return;

    let currentLevel = [ceoId];

    for (let level = 1; level <= 5; level++) {
        const nextLevel = [];
        for (const parentId of currentLevel) {
            const numReports = level === 1 ? 5 : 10;

            for (let i = 0; i < numReports; i++) {
                const employeeId = await createPerson(`Employee L${level}`, level, parentId);

                if (!employeeId) {
                    console.log("Reached target of 5556 people.");
                    return;
                }

                nextLevel.push(employeeId);
            }
        }
        currentLevel = nextLevel;
    }
    console.log("Organization chart generation completed.");
};

generateOrgChart();
