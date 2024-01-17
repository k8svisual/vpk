<topicKey storage/>
<topicBack id="topicNext" link="network"/>
<topicNext id="topicBack" link="schematic"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Storage (tab)


Storage provides a view of all defined StorageClasses, Persistent Volumes, and Persistent Volume Claims along with the amount of space requested for each.  

At the top of the view is a legend that shows several color bars that represent the associated storage measurement of space, e.g. KB, MD, GB, TB.

In the scrollable section of the view click on any of the resource icons to view the resource definition.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_storage.png" width="1024">
</p>

#### Totals by Types

Along with viewing the above information the following three categories of information are available for each node in the cluster.  Click the associated button at the top of the screen to view the information.  Clicking the button again will either open or close the section based on the current state.

Once the data is shown click any of the table rows to drill down in any of the categories. As each category is selected the data is shown above the previous category.  At any time, an item from a previous category can be selected.
#### Counts by Volume Types

Drill down this category by Type, Node, Namespace, and Pod.  
<p align="center">
  <img style="float: center;" src="docs/docimages/tab_storage_by_type.png" width="1024">
</p>

#### Counts by Cluster Node

Drill down this category by Node, Type, Namespace, and Pod. 
<p align="center">
  <img style="float: center;" src="docs/docimages/tab_storage_by_node.png" width="1024">
</p>

#### Counts by Namespace

Drill down this category by Namespace, Type, and Pod. 


<p align="center">
  <img style="float: center;" src="docs/docimages/tab_storage_by_namespace.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">


