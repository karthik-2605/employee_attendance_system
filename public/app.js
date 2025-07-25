
const checkedInTimeEl = document.querySelector('.checkin_time p:nth-child(2)');
const checkedOutTimeEl = document.querySelector('.checkin_out p:nth-child(2)');

let checkedIn = false;
let checkinTime = null;

window.addEventListener("DOMContentLoaded",()=>{
    
    
    get_employees_count();
    get_present_count();
    get_absent_count();
    setupCheckinButton();
    loadInitialRecentAttendance();
    updateAttendanceSummary();
    getAttendanceChart();
    
    if(window.location.pathname === '/employees.html'){
        loadInitialEmployees();
        setupAddEmployeePopup();
        setupAddEmployeeToDirectory();
        getAllRecordsEmployeeDirectory();
        search_filter_employee_directory();
    }
})

function setupCheckinButton(){
    const checkedInBtn = document.querySelector('.checkin_btn button');
    if(!checkedInBtn){
        console.warn("Check-in button not found");
        return;
    }

    checkedInBtn.addEventListener('click',async ()=>{
        console.log("entered checkin button");
        const userId = sessionStorage.getItem("user_id");
        console.log(userId);
        if(!userId){
            alert("Not detected user id!");
        }

        const now = new Date().toLocaleTimeString();

        if(!checkedIn){
            console.log("entered checked in condition");
            console.log(userId);
            const response = await fetch('/checkin',{
                method:"POST",
                headers:{
                    'Content-Type':'application/json'
                },
                body:JSON.stringify({userId})
            })

            const result = await response.json();

            if(response.ok){
                checkinTime = now;
                checkedInTimeEl.textContent = now;
                checkedInBtn.textContent = "Check Out";
                checkedInBtn.style.backgroundColor = "#ef4444";
                checkedIn = true;
                console.log("Checked in at: ",now);
                alert(result.message);
            }else{
                alert(result.error);
            }

            console.log(result.data);


        }else{

            const response = await fetch('/checkout',{
                method:"POST",
                headers:{
                    'Content-Type':"application/json"
                },
                body:JSON.stringify({userId})
            });

            const result = await response.json();

            if(response.ok){
                checkedOutTimeEl.textContent= now;
                checkedInBtn.textContent = "Check In";
                checkedInBtn.style.backgroundColor = "#006fff";
                checkedIn = false;
                console.log("Checked out at: ",now);
                alert(result.message);
            }else{
                alert(result.error);
            }

            console.log(result.data);

            addAttendanceRow(result.data);
        }
    })
}


function setupAddEmployeePopup(){
    const addEmployeeBtn = document.getElementById("employee_heading_add_employee_button"); 
    const popupOverlay = document.getElementById("popup_overlay");
    const closePopup = document.getElementById("closePopup");

    if(!addEmployeeBtn || !popupOverlay || !closePopup){
        console.warn("Add employee popup elements not found.");
        return;
    }

    // Show popup
    addEmployeeBtn.addEventListener("click", () => {
        console.log("hellow");
        popupOverlay.style.display = "flex"; // Makes popup and dark background visible
        document.body.style.overflow = "hidden"; // Prevents scrolling in background
    });

    // Close popup when X is clicked
    closePopup.addEventListener("click", () => {
        popupOverlay.style.display = "none";
        document.body.style.overflow = "auto";
    });

    // Optional: Close popup if user clicks outside the popup box
    popupOverlay.addEventListener("click", (event) => {
        if (event.target === popupOverlay) {
            popupOverlay.style.display = "none";
            document.body.style.overflow = "auto";
        }
    });
}


const tot_emp_cnt = document.getElementById("total_emp_cnt");
const present_emp_cnt = document.getElementById("present_emp_cnt");
const absent_emp_cnt = document.getElementById("absent_emp_cnt");
present_emp_cnt.style.color = "#22c55e";
absent_emp_cnt.style.color = '#ef4444';


 


async function updateAttendanceSummary(){
    const presentBar = document.querySelector('.tracker_bar_present .fill_bar');
    const lateBar = document.querySelector('.tracker_bar_late .fill_bar');
    const absentBar = document.querySelector('.tracker_bar_absent .fill_bar');


    const response_total = await fetch('/count_total_employees');
    const response_present = await fetch('/count_present_today');
    const response_late = await fetch('/count_late_today');

    const result1 = await response_total.json();
    const result2 = await response_present.json();
    const result3 = await response_late.json();

    const total = result1[0].count;
    const presentPct = (result2[0].count/total)*100;
    const latePct = (result3[0].count/total)*100;
    const absentPct = ((total-result2[0].count)/total)*100;

    console.log(absentPct);

    //Style bars
    
    presentBar.style.width = `${presentPct}%`
    presentBar.style.backgroundColor = '#006fff';
    

    lateBar.style.width = `${latePct}%`;
    lateBar.style.backgroundColor = '#006fff';

    absentBar.style.width = `${absentPct}%`;
    absentBar.style.backgroundColor='#006fff';

    document.getElementById("total_count_emp_id").textContent = total;
    document.getElementById("present_emp_cnt").textContent = result2[0].count;
    document.getElementById("absent_emp_cnt").textContent = result1[0].count - result2[0].count;

    document.querySelector(".tracker_absent .percentage").textContent = `${Math.round(absentPct)}%`;
    document.querySelector(".tracker_present .percentage").textContent = `${Math.round(presentPct)}%`;
    document.querySelector(".tracker_late .percentage").textContent = `${Math.round(latePct)}%`;
}



//---------------- FUNCTION TO ATTENDANCE ROW ------------------//

function addAttendanceRow(data){
    console.log("Adding row: ",data);
    const tbody = document.querySelector("#employee_info tbody");
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>${data.name}</td>
        <td>${data.date}</td>
        <td>${data.checkInTime || '-'}</td>
        <td>${data.checkOutTime || '-'}</td>
        <td>
            <div class="status_cell">
                <div class="status_cell_color" style="background-color: ${getStatusColor(data.status_of)};"></div>
                <span>${data.status_of}</span>
            </div>
        </td>
    `;

    tbody.append(tr);
}





function getStatusColor(status){
    if(status == 'Late') return "#eab308";
    if(status=='Present'){
        return "#22c55e";
    }
    if(status=='Absent'){
        return "#6f4444";
    }

    if(status == 'Half Day'){
        return "#3b82f6";
    }
}







// ATTENDANCE CHART STYLING  LINE CHART
async function getAttendanceChart(){
    const response_total = await fetch('/count_total_employees');
    const response_present = await fetch('/count_present_today');

    const result1 = await response_total.json();
    const result2 = await response_present.json();


    const months = ['Nov','Dec','Jan','Feb','Mar','Apr'];

    const presentData = [4,5,6,4,5,result2[0].count];
    const lateData = [1,3,2,0,2,result2[0].count];
    const absentData = [1,1,0,1,1,result1[0].count - result2[0].count];

    const ctx = document.getElementById("attendanceChart").getContext("2d"); // getContext() just says the we start drawing in canvas

    const chart = new Chart(ctx,{
        type: 'line',
        data:{
            labels: months,
            datasets:[
                {
                    label:"Present",
                    data: presentData,
                    borderColor:"#22c55e",
                    backgroundColor:"#22c55e55",
                    tension:0.2,
                    fill:false
                },

                {
                    label:"Late",
                    data: lateData,
                    borderColor:"#eab308",
                    backgroundColor:"#eab30855",
                    tension:0.2,
                    fill:false
                },

                {
                    label:"Absent",
                    data: absentData,
                    borderColor:"#ef4444",
                    backgroundColor:"#ef444455",
                    tension:0.2,
                    fill:false
                }
            ]
        },
        

        options:{
            responsive:true,
            plugins:{
                legend:{
                    position:'bottom',
                },
                title: {
                    display:true,
                },
            },
            scales:{
                y:{
                    beginAtZero: true,
                    ticks:{
                        padding:10,
                        stepSize:15
                    }

                },
            }
        }
    })
}







// ATTENDANCE CHART BAR CHART

const dept_labels = ["Engineering","Design","Product","Marketing","Human Resources"];
const dept_present_data = [5,7,4,6,9];
const dept_late_data = [1,0,0,0,2];
const dept_absent_data = [0,0,1,2,1];

const dept_ctx = document.getElementById("attendanceChartBarGraph").getContext("2d");

const dept_chart = new Chart(dept_ctx,{
    type:'bar',
    data:{
        labels: dept_labels,
        datasets:[
            {
                label:'Present',
                data:dept_present_data,
                backgroundColor:'#22c55e',
            },

            {
                label:'Late',
                data:dept_late_data,
                backgroundColor:'#eab308',

            },

            {
                label:'absent',
                data:dept_absent_data,
                backgroundColor:'#ef4444'

            }
        ]
    },
    options:{
        responsive:true,
        plugins:{
            legend:{
                position:'bottom',
            },

            title:{
                display:true,
            }
        },
        scales:{
            y:{
                beginAtZero: true,
                ticks:{
                    padding:10,
                    stepSize:15
                }

            },
        }
    }
});



// TRIGGERING GRAPHS CHARTS ACCORDING TO THE BUTTONS (MONTHLY TREND, BY DEPARTMENT)
const lineGraph = document.getElementById("monthly_trend_btn");
const barGraph = document.getElementById('by_department_btn');
const canvasLineGraph = document.getElementById("attendanceChart");
const canvasBarGraph = document.getElementById("attendanceChartBarGraph");

function showChart(type){
    console.log("entered function");
    if(type == "monthly"){
        console.log("entered monthly");
        canvasLineGraph.style.display="block";
        canvasBarGraph.style.display="none";
        chart.update();
    }else if(type == "department"){
        console.log("entered department");
        canvasBarGraph.style.display="block";
        canvasLineGraph.style.display="none";
        dept_chart.update();
    }
}

lineGraph.addEventListener("click",()=> {
    lineGraph.style.backgroundColor = "#ffff";
    barGraph.style.backgroundColor = "#f1f5f9";
    lineGraph.style.color = "#2463EB";
    barGraph.style.color ="black";
    showChart("monthly")
});
barGraph.addEventListener("click",()=> {
    barGraph.style.backgroundColor = "#ffff";
    lineGraph.style.backgroundColor = "#f1f5f9";
    barGraph.style.color = "#2463EB";
    lineGraph.style.color = "black";
    
    showChart("department");

});



updateAttendanceSummary();  // placed at the bottom because it is not showing animation















// ------------------------- FETCHING ATTENDANCE FROM THE BACKEND -------------------------- //
window.addEventListener("DOMContentLoaded",myattendancefunction);

async function myattendancefunction(){
    const userId = sessionStorage.getItem("user_id");
    try{
        const response = await fetch(`/api/recent-attendance?user_id=${userId}`);
        const result = await response.json();

        if(response.ok){
            const tbody = document.querySelector("#employee_info tbody");
            tbody.innerHTML='';

            result.data.forEach(data => {
                addAttendanceRow({
                    name: data.email,
                    date: data.date,
                    checkInTime: data.checkin_time,
                    checkOutTime: data.checkout_time,
                    status_of: data.status
                });
            });
        }else{
            console.log(result.error);
        }

    }catch(err){
        console.error("Error loading attendance data: ",err)

    }
}




//---------------------------------------- Viewing all records irrespective of date -----------------------------------------//

const view_records_btn = document.getElementById("view_all_records_btn").addEventListener("click",async (e)=>{

    e.preventDefault();
    const userId = sessionStorage.getItem("user_id");
    const response =await fetch(`/api/employee-manager-user-attendance?user_id=${userId}`);
    const result  = await response.json();

    if(response.ok){
        const tbody = document.querySelector("#employee_info tbody");
        tbody.innerHTML = '';
        result.data.forEach(data=>{
            addAttendanceRow({
                name: data.email,
                date:data.date,
                checkInTime: data.checkin_time,
                checkOutTime: data.checkout_time,
                status_of:data.status
            });
        })
    }else{
        console.log(result.error);
    }
        
})




//--------------------------- VIEW RECORD OF PARTICULAR EMPLOYEE IN EMPLOYEE DIRECTORY -----------
function search_filter_employee_directory(){
    const search_filter_search_btn_employee_directory = document.getElementById("search_filter_search_btn_employee_directory")
    
    if(search_filter_search_btn_employee_directory){
        search_filter_search_btn_employee_directory.addEventListener('click',async ()=>{
        const query = document.getElementById("search_employee").value.trim();
        console.log(query);
        if(query == ''){
            alert("Please enter the valid name!");
            return;
        }

        try{
            const response = await fetch(`/search-employee-directory?query=${encodeURIComponent(query)}`);
            const data = await response.json();

            const tbody = document.getElementById('employee_info_directory_body');
            tbody.innerHTML="";

            if(!response.ok){
                alert("Failed to fetch data!");
                return;


            }


            if(data.length === 0){
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan = 5>No record found</td>';
                tbody.appendChild(tr);
            }

            data.forEach(entry=>{
                setupAddEmployeeToDirectory(entry);
            })


        }catch(error){
            console.error("Error: ",error);
            alert("Error fetching the data!");
        }
        })
    }
    
    
}





//---------------------------- VIEW RECORDS OF PARTICULAR EMPLOYEE BY SEARCHING ------------------
document.getElementById("search_filter_search_btn").addEventListener("click",async ()=>{
    const query = document.getElementById("search_employee").value.trim();
    console.log(query);

    if(query == ''){
        alert("Please enter the email");
        return;
    }

    try{

        // We are using encodeURIComponent because the browser cannot encode special characters like spaces, @,?,=. So in order to include such things
        // in the url we need encodeURIComponent. 
        // where as suppose we use ?user_id = {user_id} this doesn't need encodeURIComponent because
        // it is just an interger and not any special characters involved. but in here we are passing the email. so we need this
        const response = await fetch(`/search-employee-attendance?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        console.log(data);

        const tbody = document.querySelector("#employee_info tbody");
        tbody.innerHTML = "";

        if(!response.ok){
            alert("Failed to fetch data");
            return;
        }

        if(data.length === 0){
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan ="5">No records found.</td>`;
            tbody.appendChild(tr);
            return;
        }

        data.forEach(entry=>{
            const rowData = {
                name: entry.email,
                date: entry.date,
                checkInTime:entry.checkin_time,
                checkOutTime:entry.checkout_time,
                status_of:entry.status_of
            };

            addAttendanceRow(rowData);
        })

    }catch(error){
        console.error("Error fetching attendace: ",error);
        alert("An error occurred while fetching attendance data.")
    }
})




//---------------------------- ADD EMPLOYEES IN EMPLOYEE DIRECTORY -------------------------------
function setupAddEmployeeToDirectory(){
    
    const add_emp_btn = document.getElementById("add_btn");
    if(add_emp_btn){
        add_emp_btn.addEventListener('click',async (e)=>{
        e.preventDefault();

        const fullName = document.getElementById("name").value;
        const Email = document.getElementById("email").value;
        const position = document.getElementById("position").value;
        const department = document.getElementById("department").value;

        if(!fullName || !Email || !position || !department){
            alert("All fields are required!");
            return;
        }

        const response = await fetch('/add-new-employee',{
            method:"POST",
            headers:{
                'Content-Type':'application/json'
            },
            body:JSON.stringify({fullName,Email,position,department})
        });

        const result = await response.json();

        if(response.ok){
            alert("Successfully added!");
            console.log(result.message);
            addEmployeeRowInDirectory({fullName,Email,position,department});
        }else{
            alert("Something went wrong!");
            console.error(result.error);
        }

        })
    }
    
}



function addEmployeeRowInDirectory(data){
    const tbody = document.getElementById("employee_info_directory_body");
    const tr = document.createElement('tr');

    tr.innerHTML =  `
        <td>${data.fullName || data.full_name}</td>
        <td>${data.department}</td>
        <td>${data.position}</td>
        <td>${data.Email || data.email}</td>
        <td>Actions</td>
    `;

    tbody.append(tr);
}




//--------------------- 1) view 5 records for manager ---------------------------------------
async function loadInitialEmployees(){
    try{
        const response = await fetch('/get-initial-employees');
        const employees = await response.json();

        if(Array.isArray(employees)){
            const tbody = document.getElementById("employee_info_directory_body");
            tbody.innerHTML = '';

            employees.forEach(emp=>{
                addEmployeeRowInDirectory(emp);

            })

        }else{
            alert("Failed to load employee records.");
        }
    }catch(error){
        console.error("Error fetching employees: ",error);
    }
}






//-------------------- 2) providing funcitonalit to view all records in employee directory ----------------
async function getAllRecordsEmployeeDirectory(){
    const view_btn = document.getElementById("view_all_records_btn");

    view_btn.addEventListener('click',async ()=>{
        try{
            const response = await fetch('/get-allRecords-employeeDirectory');
            const data = await response.json();

            if(Array.isArray(data)){
                const tbody = document.getElementById("employee_info_directory_body");
                tbody.innerHTML="";
                data.forEach(emp=>{
                    addEmployeeRowInDirectory(emp);
                })

                view_btn.disabled = true;
                view_btn.textContent="All records loaded ";
            }else{
                alert("No employees records found.");

            }
        }catch(err){
            console.error("error: ",err);
            alert("Something went wrong while loading all employee records.");
        }
    })

   
}




// 1) add search employee filter to employee directory
// 2) add limit of number of employees visible data for dashboard of employee and manager as well




//--------------------------------------- Load Initial recent attendance data for manager -----------------------------
async function loadInitialRecentAttendance(){
    try{
        const response = await fetch('/load-initial-recent-attendance-data');
        const result = await response.json();

        console.log(result);

        if(response.ok){
            console.log("entered if condition!");
            const tbody = document.getElementById("manager_tbody");
            tbody.innerHTML = '';
            result.data.forEach(data=>{
                console.log(data);
                addAttendanceRow({
                    name: data.email,
                    date:data.date,
                    checkInTime: data.checkin_time,
                    checkOutTime: data.checkout_time,
                    status_of:data.status
                });
            })
        }else{
            alert("Failed to load the initial data");
        }

    }catch(error){
        console.error(error);
        return;
    }


}













//--------------------- GET EMPLOYEES COUNT IN DASHBOARD --------------------
async function get_employees_count(){
    const response = await fetch('/count_total_employees');
    const result = await response.json();

    const total_count_emp1 = document.getElementById("total_count_emp_id");
    const total_count_emp_1 = document.getElementById("total_count_emp_id1");
    total_count_emp1.innerHTML= `${result[0].count}`;
    total_count_emp_1.innerHTML=`${result[0].count}`;
    console.log(result[0].count);

}








//----------------------- GET PRESENT COUNT ATTENDANCE FOR THE DAT---------------------------
async function get_present_count(){
    const response = await fetch('/count_present_today');
    const result = await response.json();

    const present_today_cnt = document.getElementById("present_emp_cnt");

    present_today_cnt.innerHTML = `${result[0].count}`;
    console.log("present count for the date: ");

    console.log(present_today_cnt);

}












//----------------------- GET ABSENT COUNT ATTENDANCE FOR THE DAT---------------------------
async function get_absent_count(){
    const response1 = await fetch('/count_total_employees');
    const result1 = await response1.json();

    const response2 = await fetch('/count_present_today');
    const result2 = await response2.json();

    const absent_today_cnt = document.getElementById("absent_emp_cnt");

    absent_today_cnt.innerHTML = `${result1[0].count - result2[0].count}`;
    console.log("absent count for the date: ");

    console.log(absent_today_cnt);

}




















/*

//----------------------- GET late COUNT ATTENDANCE FOR THE DAT---------------------------
async function get_late_count(){
    const response = await fetch('/count_present_today');
    const result = await response.json();

    const present_today_cnt = document.getElementById("late_emp_count");

    present_today_cnt.innerHTML = `${result[0].count}`;
    console.log("present count for the date: ");

    console.log(present_today_cnt);

}

*/